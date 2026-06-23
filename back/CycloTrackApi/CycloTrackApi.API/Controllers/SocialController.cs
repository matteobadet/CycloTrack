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
    public async Task<IActionResult> GetFeed([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var followedIds = await db.Follows
            .Where(f => f.FollowerId == UserId)
            .Select(f => f.FollowedId)
            .ToListAsync();

        var rides = await rideRepo.GetFeedAsync(followedIds, page, pageSize);
        var rideIds = rides.Select(r => r.Id).ToList();

        var allReactions = await db.Reactions
            .Where(r => rideIds.Contains(r.RideId))
            .ToListAsync();

        var allComments = await db.Comments
            .Include(c => c.User)
            .Where(c => rideIds.Contains(c.RideId))
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        var allPoints = await db.RidePoints
            .Where(p => rideIds.Contains(p.RideId))
            .OrderBy(p => p.Timestamp)
            .Select(p => new { p.RideId, p.Lat, p.Lng })
            .ToListAsync();

        var pointsByRide = allPoints.GroupBy(p => p.RideId).ToDictionary(g => g.Key, g => g.ToList());

        var result = rides.Select(r =>
        {
            var rideReactions = allReactions.Where(rx => rx.RideId == r.Id).ToList();
            var rideComments = allComments.Where(c => c.RideId == r.Id).ToList();

            var reactionGroups = rideReactions
                .GroupBy(rx => rx.Emoji)
                .Select(g => new ReactionGroupDto(g.Key, g.Count(), g.Any(rx => rx.UserId == UserId)))
                .ToList();

            var rawPoints = pointsByRide.TryGetValue(r.Id, out var pts) ? pts : [];
            var step = Math.Max(1, rawPoints.Count / 60);
            var simplified = rawPoints
                .Where((_, i) => i % step == 0)
                .Select(p => new SimplePointDto(p.Lat, p.Lng))
                .ToList();

            return new FeedRideDto(
                r.Id, r.UserId, r.User?.Pseudo ?? string.Empty,
                r.StartedAt, r.EndedAt,
                r.DistanceKm, r.DurationSec,
                r.ElevationGainM, r.ElevationLossM,
                r.AvgSpeedKmh, r.AvgWatts, r.CaloriesBurned,
                reactionGroups,
                rideComments.Count,
                rideComments.TakeLast(2).Select(c => new CommentDto(c.Id, c.UserId, c.User.Pseudo, c.Text, c.CreatedAt)).ToList(),
                simplified
            );
        }).ToList();

        return Ok(result);
    }

    [HttpGet("stories")]
    public async Task<IActionResult> GetStories()
    {
        var today = DateTime.UtcNow.Date;
        var followedIds = await db.Follows
            .Where(f => f.FollowerId == UserId)
            .Select(f => f.FollowedId)
            .ToListAsync();

        var stories = await db.Rides
            .Include(r => r.User)
            .Where(r => followedIds.Contains(r.UserId) && r.StartedAt >= today)
            .GroupBy(r => new { r.UserId, r.User!.Pseudo })
            .Select(g => new StoryUserDto(g.Key.UserId, g.Key.Pseudo, g.Max(r => r.StartedAt)))
            .ToListAsync();

        return Ok(stories);
    }

    // --- Reactions ---

    [HttpPost("reactions/{rideId:guid}")]
    public async Task<IActionResult> React(Guid rideId, [FromBody] ReactRequest req)
    {
        var existing = await db.Reactions.FirstOrDefaultAsync(r => r.RideId == rideId && r.UserId == UserId);
        if (existing != null)
        {
            if (existing.Emoji == req.Emoji)
            {
                db.Reactions.Remove(existing);
                await db.SaveChangesAsync();
                return NoContent();
            }
            db.Reactions.Remove(existing);
        }
        db.Reactions.Add(new Reaction { RideId = rideId, UserId = UserId, Emoji = req.Emoji });

        // Notify ride owner (not self)
        var ride = await db.Rides.Include(r => r.User).FirstOrDefaultAsync(r => r.Id == rideId);
        if (ride != null && ride.UserId != UserId)
        {
            var actor = await db.Users.FindAsync(UserId);
            db.Notifications.Add(new Notification
            {
                UserId = ride.UserId,
                Type = NotificationType.Reaction,
                Message = $"{actor?.Pseudo} a réagi {req.Emoji} à votre sortie.",
                RideId = rideId,
            });
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    // --- Comments ---

    [HttpGet("comments/{rideId:guid}")]
    public async Task<IActionResult> GetComments(Guid rideId)
    {
        var comments = await db.Comments
            .Include(c => c.User)
            .Where(c => c.RideId == rideId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return Ok(comments.Select(c => new CommentDto(c.Id, c.UserId, c.User.Pseudo, c.Text, c.CreatedAt)));
    }

    [HttpPost("comments/{rideId:guid}")]
    public async Task<IActionResult> AddComment(Guid rideId, [FromBody] AddCommentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Text)) return BadRequest();
        db.Comments.Add(new Comment { RideId = rideId, UserId = UserId, Text = req.Text.Trim() });

        // Notify ride owner (not self)
        var ride = await db.Rides.FirstOrDefaultAsync(r => r.Id == rideId);
        if (ride != null && ride.UserId != UserId)
        {
            var actor = await db.Users.FindAsync(UserId);
            db.Notifications.Add(new Notification
            {
                UserId = ride.UserId,
                Type = NotificationType.Comment,
                Message = $"{actor?.Pseudo} a commenté votre sortie.",
                RideId = rideId,
            });
        }

        await db.SaveChangesAsync();

        var comments = await db.Comments
            .Include(c => c.User)
            .Where(c => c.RideId == rideId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return Ok(comments.Select(c => new CommentDto(c.Id, c.UserId, c.User.Pseudo, c.Text, c.CreatedAt)));
    }

    [HttpDelete("comments/{commentId:guid}")]
    public async Task<IActionResult> DeleteComment(Guid commentId)
    {
        var comment = await db.Comments.FindAsync(commentId);
        if (comment is null || comment.UserId != UserId) return NotFound();
        db.Comments.Remove(comment);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // --- Follow ---

    [HttpPost("follow/{targetUserId:guid}")]
    public async Task<IActionResult> Follow(Guid targetUserId)
    {
        if (targetUserId == UserId) return BadRequest();
        var exists = await db.Follows.AnyAsync(f => f.FollowerId == UserId && f.FollowedId == targetUserId);
        if (exists) return Conflict();

        db.Follows.Add(new Follow { FollowerId = UserId, FollowedId = targetUserId });

        // Notify the followed user
        var actor = await db.Users.FindAsync(UserId);
        db.Notifications.Add(new Notification
        {
            UserId = targetUserId,
            Type = NotificationType.Follow,
            Message = $"{actor?.Pseudo} a commencé à vous suivre.",
        });

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
    public async Task<IActionResult> Leaderboard([FromQuery] string period = "month", [FromQuery] string metric = "distance", [FromQuery] bool followingOnly = false)
    {
        var start = period switch
        {
            "week" => DateTime.UtcNow.AddDays(-7),
            "year" => DateTime.UtcNow.AddYears(-1),
            _ => DateTime.UtcNow.AddMonths(-1),
        };

        IQueryable<Ride> baseQuery = db.Rides.Include(r => r.User).Where(r => r.StartedAt >= start);

        if (followingOnly)
        {
            var followedIds = await db.Follows
                .Where(f => f.FollowerId == UserId)
                .Select(f => f.FollowedId)
                .ToListAsync();
            followedIds.Add(UserId);
            baseQuery = baseQuery.Where(r => followedIds.Contains(r.UserId));
        }

        var query = baseQuery.GroupBy(r => new { r.UserId, r.User!.Pseudo });

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

    [HttpGet("following")]
    public async Task<IActionResult> GetFollowing()
    {
        var ids = await db.Follows
            .Where(f => f.FollowerId == UserId)
            .Select(f => f.FollowedId)
            .ToListAsync();
        return Ok(ids);
    }

    [HttpGet("users")]
    public async Task<IActionResult> SearchUsers([FromQuery] string q = "")
    {
        var followedIds = await db.Follows
            .Where(f => f.FollowerId == UserId)
            .Select(f => f.FollowedId)
            .ToHashSetAsync();

        var users = await db.Users
            .Where(u => u.Id != UserId && (string.IsNullOrEmpty(q) || u.Pseudo.Contains(q)))
            .Take(20)
            .Select(u => new { u.Id, u.Pseudo })
            .ToListAsync();

        return Ok(users.Select(u => new { u.Id, u.Pseudo, IsFollowing = followedIds.Contains(u.Id) }));
    }
}
