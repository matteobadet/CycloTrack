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
[Route("goals")]
[Authorize]
public class GoalsController(IGoalRepository goalRepo, AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<GoalDto>>> GetGoals()
    {
        var goals = await goalRepo.GetByUserIdAsync(UserId);
        var result = new List<GoalDto>();
        foreach (var g in goals)
            result.Add(new GoalDto(g.Id, g.Type, g.Period, g.TargetValue, g.Description,
                g.StartDate, g.EndDate, g.IsAchieved, await ComputeCurrentValue(g)));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<GoalDto>> CreateGoal(CreateGoalRequest req)
    {
        var goal = new Goal
        {
            UserId = UserId,
            Type = req.Type,
            Period = req.Period,
            TargetValue = req.TargetValue,
            Description = req.Description,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
        };
        await goalRepo.AddAsync(goal);
        return CreatedAtAction(null, new GoalDto(goal.Id, goal.Type, goal.Period, goal.TargetValue,
            goal.Description, goal.StartDate, goal.EndDate, false, 0));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteGoal(Guid id)
    {
        var goal = await goalRepo.GetByIdAsync(id);
        if (goal is null || goal.UserId != UserId) return NotFound();
        await goalRepo.DeleteAsync(goal);
        return NoContent();
    }

    private async Task<float> ComputeCurrentValue(Goal goal)
    {
        var rides = db.Rides.Where(r => r.UserId == UserId
            && r.StartedAt >= goal.StartDate && r.StartedAt <= goal.EndDate);

        return goal.Type switch
        {
            GoalType.Distance => await rides.SumAsync(r => (float?)r.DistanceKm) ?? 0f,
            GoalType.Elevation => await rides.SumAsync(r => (float?)r.ElevationGainM) ?? 0f,
            GoalType.RideCount => await rides.CountAsync(),
            GoalType.Performance => await rides.AnyAsync()
                ? await rides.MaxAsync(r => (float?)r.AvgWatts) ?? 0f
                : 0f,
            _ => 0f,
        };
    }
}
