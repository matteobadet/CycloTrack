using CycloTrackApi.Core.Entities;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class NotificationsController(AppDbContext db) : ControllerBase
{
    Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var notifs = await db.Notifications
            .Where(n => n.UserId == UserId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new {
                id = n.Id,
                message = n.Message,
                type = n.Type.ToString().ToLower(),
                isRead = n.IsRead,
                createdAt = n.CreatedAt,
                rideId = n.RideId,
            })
            .ToListAsync();

        return Ok(notifs);
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await db.Notifications
            .Where(n => n.UserId == UserId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return NoContent();
    }
}
