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
[Route("social")]
[Authorize]
public class SocialController(AppDbContext db, IRideRepository rideRepo) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet("feed")]
    public async Task<ActionResult<IEnumerable<RideDto>>> GetFeed([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var followedIds = await db.Follows
            .Where(f => f.FollowerId == UserId)
            .Select(f => f.FollowedId)
            .ToListAsync();

        var rides = await rideRepo.GetFeedAsync(followedIds, page, pageSize);
        return Ok(rides.Select(r => new RideDto(
            r.Id, r.UserId, r.User?.Pseudo ?? string.Empty,
            r.StartedAt, r.EndedAt, r.DistanceKm, r.DurationSec,
            r.ElevationGainM, r.ElevationLossM, r.AvgSpeedKmh, r.MaxSpeedKmh,
            r.AvgWatts, r.MaxWatts, r.AvgCadenceRpm, r.AvgBpm, r.MaxBpm,
            r.CaloriesBurned, r.FeelBefore, r.CommentBefore, null)));
    }

    [HttpPost("follow/{targetUserId:guid}")]
    public async Task<IActionResult> Follow(Guid targetUserId)
    {
        if (targetUserId == UserId) return BadRequest();
        var exists = await db.Follows.AnyAsync(f => f.FollowerId == UserId && f.FollowedId == targetUserId);
        if (exists) return Conflict();

        db.Follows.Add(new Follow { FollowerId = UserId, FollowedId = targetUserId });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("follow/{targetUserId:guid}")]
    public async Task<IActionResult> Unfollow(Guid targetUserId)
    {
        var follow = await db.Follows.FirstOrDefaultAsync(f => f.FollowerId == UserId && f.FollowedId == targetUserId);
        if (follow is null) return NotFound();
        db.Follows.Remove(follow);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("leaderboard")]
    public async Task<IActionResult> Leaderboard([FromQuery] string period = "month", [FromQuery] string metric = "distance")
    {
        var start = period switch
        {
            "week" => DateTime.UtcNow.AddDays(-7),
            "year" => DateTime.UtcNow.AddYears(-1),
            _ => DateTime.UtcNow.AddMonths(-1),
        };

        var query = db.Rides
            .Include(r => r.User)
            .Where(r => r.StartedAt >= start)
            .GroupBy(r => new { r.UserId, r.User!.Pseudo });

        var leaderboard = metric switch
        {
            "elevation" => await query
                .Select(g => new { g.Key.UserId, g.Key.Pseudo, Value = g.Sum(r => (double)r.ElevationGainM) })
                .OrderByDescending(x => x.Value).Take(20).ToListAsync(),
            "watts" => await query
                .Select(g => new { g.Key.UserId, g.Key.Pseudo, Value = g.Average(r => (double?)r.AvgWatts) ?? 0 })
                .OrderByDescending(x => x.Value).Take(20).ToListAsync(),
            _ => await query
                .Select(g => new { g.Key.UserId, g.Key.Pseudo, Value = g.Sum(r => (double)r.DistanceKm) })
                .OrderByDescending(x => x.Value).Take(20).ToListAsync(),
        };

        return Ok(leaderboard);
    }

    [HttpGet("users")]
    public async Task<IActionResult> SearchUsers([FromQuery] string q = "")
    {
        var users = await db.Users
            .Where(u => u.Id != UserId && (string.IsNullOrEmpty(q) || u.Pseudo.Contains(q)))
            .Take(20)
            .Select(u => new { u.Id, u.Pseudo })
            .ToListAsync();
        return Ok(users);
    }
}
