using System.Security.Claims;
using CycloTrackApi.API.Dtos;
using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("rides")]
[Authorize]
public class RidesController(IRideRepository rideRepo, IUserRepository userRepo, IAiService aiService, ISpotifyService spotifyService, AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RideDto>>> GetMyRides([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var rides = await rideRepo.GetByUserIdAsync(UserId, page, pageSize);
        return Ok(rides.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RideDetailDto>> GetRide(Guid id)
    {
        var ride = await rideRepo.GetByIdAsync(id);
        if (ride is null) return NotFound();

        // Allow access to own rides or rides of followed users
        if (ride.UserId != UserId)
        {
            var isFollowing = await db.Follows.AnyAsync(f => f.FollowerId == UserId && f.FollowedId == ride.UserId);
            if (!isFollowing) return NotFound();
        }

        var points = await rideRepo.GetPointsByRideIdAsync(id);
        var tracks = await db.RideTracks
            .Where(t => t.RideId == id)
            .OrderBy(t => t.PolledAt)
            .ToListAsync();

        var insights = ComputeMusicInsights(tracks);

        return Ok(new RideDetailDto(
            ToDto(ride),
            points.Select(ToPointDto).ToList(),
            insights,
            tracks.Select(ToTrackDto).ToList()
        ));
    }

    [HttpPost]
    public async Task<ActionResult<RideDto>> CreateRide(CreateRideRequest req)
    {
        var ride = new Ride
        {
            UserId = UserId,
            StartedAt = req.StartedAt,
            EndedAt = req.EndedAt,
            DistanceKm = req.DistanceKm,
            DurationSec = req.DurationSec,
            ElevationGainM = req.ElevationGainM,
            ElevationLossM = req.ElevationLossM,
            AvgSpeedKmh = req.AvgSpeedKmh,
            MaxSpeedKmh = req.MaxSpeedKmh,
            AvgWatts = req.AvgWatts,
            MaxWatts = req.MaxWatts,
            AvgCadenceRpm = req.AvgCadenceRpm,
            AvgBpm = req.AvgBpm,
            MaxBpm = req.MaxBpm,
            CaloriesBurned = req.CaloriesBurned,
            FeelBefore = req.FeelBefore,
            CommentBefore = req.CommentBefore,
        };
        await rideRepo.AddAsync(ride);

        if (req.Points.Count > 0)
        {
            var points = req.Points.Select(p => new RidePoint
            {
                RideId = ride.Id,
                Timestamp = p.Timestamp,
                Lat = p.Lat,
                Lng = p.Lng,
                AltitudeM = p.AltitudeM,
                SpeedKmh = p.SpeedKmh,
                Watts = p.Watts,
                Bpm = p.Bpm,
                CadenceRpm = p.CadenceRpm,
            });
            await rideRepo.AddPointsAsync(points);
        }

        return CreatedAtAction(nameof(GetRide), new { id = ride.Id }, ToDto(ride));
    }

    [HttpPost("{id:guid}/analyze")]
    public async Task<ActionResult<object>> Analyze(Guid id)
    {
        var ride = await rideRepo.GetByIdAsync(id);
        if (ride is null || ride.UserId != UserId) return NotFound();
        if (!string.IsNullOrEmpty(ride.AiAnalysis))
            return Ok(new { analysis = ride.AiAnalysis });

        var user = await userRepo.GetByIdAsync(UserId);
        if (user is null) return NotFound();

        var tracks = await db.RideTracks
            .Where(t => t.RideId == id)
            .OrderBy(t => t.PolledAt)
            .ToListAsync();

        try
        {
            var analysis = await aiService.AnalyzeRideAsync(ride, user, tracks);
            ride.AiAnalysis = analysis;
            await rideRepo.UpdateAsync(ride);
            return Ok(new { analysis });
        }
        catch (HttpRequestException ex) when (ex.Message.Contains("credit balance"))
        {
            return StatusCode(402, new { error = "Solde Anthropic insuffisant. Recharge les crédits sur console.anthropic.com." });
        }
        catch (Exception)
        {
            return StatusCode(503, new { error = "Le service d'analyse IA est temporairement indisponible." });
        }
    }

    // Mobile calls this every 30s during a ride to capture Spotify currently-playing
    [HttpPost("{id:guid}/tracks/poll")]
    public async Task<ActionResult<object>> PollTrack(Guid id, PollTrackRequest req)
    {
        var ride = await rideRepo.GetByIdAsync(id);
        if (ride is null || ride.UserId != UserId) return NotFound();

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();

        if (user.SpotifyRefreshToken is null)
            return Ok(new { linked = false });

        // Refresh token if needed
        if (user.SpotifyTokenExpiresAt < DateTime.UtcNow || user.SpotifyAccessToken is null)
        {
            try
            {
                var newToken = await spotifyService.RefreshAccessTokenAsync(user.SpotifyRefreshToken);
                user.SpotifyAccessToken = newToken;
                user.SpotifyTokenExpiresAt = DateTime.UtcNow.AddMinutes(55);
                await db.SaveChangesAsync();
            }
            catch
            {
                return Ok(new { linked = true, playing = false });
            }
        }

        var current = await spotifyService.GetCurrentlyPlayingAsync(user.SpotifyAccessToken!);
        if (current is null)
            return Ok(new { linked = true, playing = false });

        // Fetch audio features (reuse if we already have them for this track in this ride)
        float? tempo = null, energy = null, valence = null;
        var existing = await db.RideTracks
            .Where(t => t.RideId == id && t.SpotifyTrackId == current.Id && t.Tempo != null)
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            tempo = existing.Tempo;
            energy = existing.Energy;
            valence = existing.Valence;
        }
        else
        {
            var features = await spotifyService.GetAudioFeaturesAsync(user.SpotifyAccessToken!, current.Id);
            if (features != null) { tempo = features.Tempo; energy = features.Energy; valence = features.Valence; }
        }

        var track = new RideTrack
        {
            RideId = id,
            SpotifyTrackId = current.Id,
            TrackName = current.TrackName,
            ArtistName = current.ArtistName,
            AlbumArtUrl = current.AlbumArtUrl,
            Tempo = tempo,
            Energy = energy,
            Valence = valence,
            PolledAt = DateTime.UtcNow,
            SpeedKmh = req.CurrentSpeedKmh,
            Watts = req.CurrentWatts,
            Bpm = req.CurrentBpm,
            ElevDeltaM = req.ElevDeltaM,
        };
        db.RideTracks.Add(track);
        await db.SaveChangesAsync();

        return Ok(new
        {
            linked = true,
            playing = true,
            trackName = current.TrackName,
            artistName = current.ArtistName,
            albumArtUrl = current.AlbumArtUrl,
            tempo,
        });
    }

    // --- helpers ---

    private static List<MusicInsightDto> ComputeMusicInsights(List<RideTrack> tracks)
    {
        if (tracks.Count == 0) return [];

        var insights = new List<MusicInsightDto>();

        // Group by track to compute averages
        var grouped = tracks
            .GroupBy(t => t.SpotifyTrackId)
            .Select(g => new
            {
                g.First().TrackName,
                g.First().ArtistName,
                g.First().AlbumArtUrl,
                g.First().Tempo,
                g.First().Energy,
                g.First().Valence,
                Count = g.Count(),
                AvgSpeed = g.Where(x => x.SpeedKmh.HasValue).Select(x => x.SpeedKmh!.Value).DefaultIfEmpty(0).Average(),
                AvgWatts = g.Where(x => x.Watts.HasValue).Select(x => x.Watts!.Value).DefaultIfEmpty(0).Average(),
                AvgBpm = g.Where(x => x.Bpm.HasValue).Select(x => (float)x.Bpm!.Value).DefaultIfEmpty(0).Average(),
                TotalElev = g.Where(x => x.ElevDeltaM.HasValue).Sum(x => x.ElevDeltaM!.Value),
            })
            .ToList();

        // Power anthem
        var withWatts = grouped.Where(g => g.AvgWatts > 0).ToList();
        if (withWatts.Count > 0)
        {
            var top = withWatts.MaxBy(g => g.AvgWatts)!;
            insights.Add(new MusicInsightDto(
                "⚡", "Hymne de puissance",
                $"Tu as développé en moyenne {top.AvgWatts:F0} W sous ce son",
                top.TrackName, top.ArtistName, top.AlbumArtUrl));
        }

        // Speed peak
        var withSpeed = grouped.Where(g => g.AvgSpeed > 0).ToList();
        if (withSpeed.Count > 0)
        {
            var top = withSpeed.MaxBy(g => g.AvgSpeed)!;
            insights.Add(new MusicInsightDto(
                "🚀", "Pic de vitesse",
                $"Ta vitesse moyenne était de {top.AvgSpeed:F1} km/h sous ce son",
                top.TrackName, top.ArtistName, top.AlbumArtUrl));
        }

        // Climbing motor
        var withElev = grouped.Where(g => g.TotalElev > 0).ToList();
        if (withElev.Count > 0)
        {
            var top = withElev.MaxBy(g => g.TotalElev)!;
            insights.Add(new MusicInsightDto(
                "🏔️", "Moteur de montée",
                $"+{top.TotalElev:F0} m de dénivelé grimpé sous ce son",
                top.TrackName, top.ArtistName, top.AlbumArtUrl));
        }

        // Vibe boost (highest valence = most positive song + good performance)
        var withValence = grouped.Where(g => g.Valence.HasValue && g.AvgSpeed > 0).ToList();
        if (withValence.Count > 0)
        {
            var top = withValence.MaxBy(g => g.Valence)!;
            insights.Add(new MusicInsightDto(
                "😊", "Boost de moral",
                $"La chanson la plus positive de ta sortie (valence {top.Valence:P0})",
                top.TrackName, top.ArtistName, top.AlbumArtUrl));
        }

        return insights;
    }

    [HttpPatch("{id:guid}/feedback")]
    public async Task<IActionResult> UpdateFeedback(Guid id, [FromBody] RideFeedbackRequest req)
    {
        var ride = await db.Rides.FirstOrDefaultAsync(r => r.Id == id && r.UserId == UserId);
        if (ride is null) return NotFound();
        ride.FeelAfter = req.FeelAfter;
        ride.CommentAfter = req.CommentAfter;
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static RideDto ToDto(Ride r) => new(
        r.Id, r.UserId, r.User?.Pseudo ?? string.Empty,
        r.StartedAt, r.EndedAt, r.DistanceKm, r.DurationSec,
        r.ElevationGainM, r.ElevationLossM, r.AvgSpeedKmh, r.MaxSpeedKmh,
        r.AvgWatts, r.MaxWatts, r.AvgCadenceRpm, r.AvgBpm, r.MaxBpm,
        r.CaloriesBurned, r.FeelBefore, r.CommentBefore, r.FeelAfter, r.CommentAfter, r.AiAnalysis);

    private static RidePointDto ToPointDto(RidePoint p) => new(
        p.Timestamp, p.Lat, p.Lng, p.AltitudeM, p.SpeedKmh, p.Watts, p.Bpm, p.CadenceRpm);

    private static RideTrackDto ToTrackDto(RideTrack t) => new(
        t.TrackName, t.ArtistName, t.AlbumArtUrl,
        t.Tempo, t.Energy, t.Valence,
        t.PolledAt, t.SpeedKmh, t.Watts, t.Bpm);
}
