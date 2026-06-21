using System.Security.Claims;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("stats")]
[Authorize]
public class StatsController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        var rides = db.Rides.Where(r => r.UserId == UserId);

        var totalRides = await rides.CountAsync();
        var totalDistanceKm = await rides.SumAsync(r => (double?)r.DistanceKm) ?? 0;
        var totalElevationM = await rides.SumAsync(r => (double?)r.ElevationGainM) ?? 0;
        var totalCalories = await rides.SumAsync(r => (double?)r.CaloriesBurned) ?? 0;

        var recentRides = await rides
            .OrderByDescending(r => r.StartedAt)
            .Take(5)
            .Select(r => new
            {
                r.Id,
                r.StartedAt,
                r.DistanceKm,
                r.DurationSec,
                r.AvgSpeedKmh,
            })
            .ToListAsync();

        return Ok(new
        {
            totalRides,
            totalDistanceKm,
            totalElevationM,
            totalCalories,
            recentRides,
        });
    }
}
