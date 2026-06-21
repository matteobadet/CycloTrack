using System.Security.Claims;
using CycloTrackApi.API.Dtos;
using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("rides")]
[Authorize]
public class RidesController(IRideRepository rideRepo, IUserRepository userRepo, IAiService aiService) : ControllerBase
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
        if (ride is null || ride.UserId != UserId) return NotFound();

        var points = await rideRepo.GetPointsByRideIdAsync(id);
        return Ok(new RideDetailDto(ToDto(ride), points.Select(ToPointDto).ToList()));
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

        var analysis = await aiService.AnalyzeRideAsync(ride, user);
        ride.AiAnalysis = analysis;
        await rideRepo.UpdateAsync(ride);

        return Ok(new { analysis });
    }

    private static RideDto ToDto(Ride r) => new(
        r.Id, r.UserId, r.User?.Pseudo ?? string.Empty,
        r.StartedAt, r.EndedAt, r.DistanceKm, r.DurationSec,
        r.ElevationGainM, r.ElevationLossM, r.AvgSpeedKmh, r.MaxSpeedKmh,
        r.AvgWatts, r.MaxWatts, r.AvgCadenceRpm, r.AvgBpm, r.MaxBpm,
        r.CaloriesBurned, r.FeelBefore, r.CommentBefore, r.AiAnalysis);

    private static RidePointDto ToPointDto(RidePoint p) => new(
        p.Timestamp, p.Lat, p.Lng, p.AltitudeM, p.SpeedKmh, p.Watts, p.Bpm, p.CadenceRpm);
}
