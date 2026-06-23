using System.Security.Claims;
using CycloTrackApi.Core.Entities;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("social/challenges")]
[Authorize]
public class ChallengesController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    // GET /social/challenges — list challenges the user created or joined
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var participatedIds = await db.ChallengeParticipants
            .Where(cp => cp.UserId == UserId)
            .Select(cp => cp.ChallengeId)
            .ToListAsync();

        var challenges = await db.Challenges
            .Include(c => c.Creator)
            .Include(c => c.Participants).ThenInclude(cp => cp.User)
            .Where(c => c.CreatorId == UserId || participatedIds.Contains(c.Id))
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return Ok(challenges.Select(c => MapChallenge(c, UserId)));
    }

    // POST /social/challenges
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateChallengeRequest req)
    {
        var challenge = new Challenge
        {
            CreatorId = UserId,
            Title = req.Title,
            Type = req.Type,
            TargetValue = req.TargetValue,
            StartDate = req.StartDate.ToUniversalTime(),
            EndDate = req.EndDate.ToUniversalTime(),
        };
        db.Challenges.Add(challenge);

        // Creator auto-joins
        db.ChallengeParticipants.Add(new ChallengeParticipant { ChallengeId = challenge.Id, UserId = UserId });

        await db.SaveChangesAsync();

        var created = await db.Challenges
            .Include(c => c.Creator)
            .Include(c => c.Participants).ThenInclude(cp => cp.User)
            .FirstAsync(c => c.Id == challenge.Id);

        return Ok(MapChallenge(created, UserId));
    }

    // POST /social/challenges/{id}/join
    [HttpPost("{id:guid}/join")]
    public async Task<IActionResult> Join(Guid id)
    {
        var challenge = await db.Challenges
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (challenge is null) return NotFound();

        var alreadyIn = challenge.Participants.Any(cp => cp.UserId == UserId);
        if (alreadyIn) return Conflict(new { error = "Déjà participant" });

        db.ChallengeParticipants.Add(new ChallengeParticipant { ChallengeId = id, UserId = UserId });
        await db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /social/challenges/{id}/leave
    [HttpDelete("{id:guid}/leave")]
    public async Task<IActionResult> Leave(Guid id)
    {
        var cp = await db.ChallengeParticipants.FindAsync(id, UserId);
        if (cp is null) return NotFound();
        db.ChallengeParticipants.Remove(cp);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // GET /social/challenges/discover — find challenges from followed users
    [HttpGet("discover")]
    public async Task<IActionResult> Discover()
    {
        var followedIds = await db.Follows
            .Where(f => f.FollowerId == UserId)
            .Select(f => f.FollowedId)
            .ToListAsync();

        var joinedIds = await db.ChallengeParticipants
            .Where(cp => cp.UserId == UserId)
            .Select(cp => cp.ChallengeId)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var challenges = await db.Challenges
            .Include(c => c.Creator)
            .Include(c => c.Participants).ThenInclude(cp => cp.User)
            .Where(c => followedIds.Contains(c.CreatorId) && !joinedIds.Contains(c.Id) && c.EndDate > now)
            .OrderByDescending(c => c.CreatedAt)
            .Take(10)
            .ToListAsync();

        return Ok(challenges.Select(c => MapChallenge(c, UserId)));
    }

    private object MapChallenge(Challenge c, Guid currentUserId)
    {
        // Compute progress per participant from their rides in the date window
        var participantProgress = c.Participants.Select(cp =>
        {
            // Progress is computed client-side or via a separate query; return 0 for now
            return new
            {
                userId = cp.UserId,
                pseudo = cp.User?.Pseudo ?? "",
                joinedAt = cp.JoinedAt,
                isMe = cp.UserId == currentUserId,
            };
        }).ToList();

        var isParticipant = c.Participants.Any(cp => cp.UserId == currentUserId);
        var now = DateTime.UtcNow;

        return new
        {
            id = c.Id,
            title = c.Title,
            type = c.Type,
            targetValue = c.TargetValue,
            startDate = c.StartDate,
            endDate = c.EndDate,
            createdAt = c.CreatedAt,
            creatorId = c.CreatorId,
            creatorPseudo = c.Creator?.Pseudo ?? "",
            isParticipant,
            isCreator = c.CreatorId == currentUserId,
            isActive = now >= c.StartDate && now <= c.EndDate,
            isEnded = now > c.EndDate,
            participants = participantProgress,
        };
    }
}

public record CreateChallengeRequest(
    string Title,
    string Type,
    float TargetValue,
    DateTime StartDate,
    DateTime EndDate
);
