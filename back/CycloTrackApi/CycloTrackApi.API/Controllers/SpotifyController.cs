using System.Security.Claims;
using CycloTrackApi.Core.Interfaces;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("spotify")]
[Authorize]
public class SpotifyController(ISpotifyService spotifyService, AppDbContext db, IConfiguration config) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    private string CallbackUrl => config["Spotify:CallbackUrl"] ?? "http://localhost:5002/spotify/callback";

    [HttpGet("auth-url")]
    public IActionResult GetAuthUrl([FromQuery] string? redirectUri = null)
    {
        var state = UserId.ToString();
        var url = spotifyService.GetAuthUrl(redirectUri ?? CallbackUrl, state);
        return Ok(new { url });
    }

    // Called by Spotify after user authorizes via web (redirect_uri = CallbackUrl)
    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string code, [FromQuery] string state)
    {
        if (!Guid.TryParse(state, out var userId))
            return BadRequest("État invalide.");

        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        var tokens = await spotifyService.ExchangeCodeAsync(code, CallbackUrl);
        user.SpotifyAccessToken = tokens.AccessToken;
        user.SpotifyRefreshToken = tokens.RefreshToken;
        user.SpotifyTokenExpiresAt = tokens.ExpiresAt;
        await db.SaveChangesAsync();

        return Redirect("http://localhost:82/profile?spotify=linked");
    }

    // Called by mobile app after intercepting Spotify redirect
    [HttpPost("exchange")]
    public async Task<IActionResult> Exchange([FromBody] ExchangeRequest req)
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();

        var tokens = await spotifyService.ExchangeCodeAsync(req.Code, req.RedirectUri);
        user.SpotifyAccessToken = tokens.AccessToken;
        user.SpotifyRefreshToken = tokens.RefreshToken;
        user.SpotifyTokenExpiresAt = tokens.ExpiresAt;
        await db.SaveChangesAsync();

        return Ok(new { linked = true });
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var user = await db.Users.FindAsync(UserId);
        var linked = user?.SpotifyRefreshToken != null;
        return Ok(new { linked });
    }

    [HttpDelete("unlink")]
    public async Task<IActionResult> Unlink()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();
        user.SpotifyAccessToken = null;
        user.SpotifyRefreshToken = null;
        user.SpotifyTokenExpiresAt = null;
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record ExchangeRequest(string Code, string RedirectUri);
