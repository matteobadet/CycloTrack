using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CycloTrackApi.API.Dtos;
using CycloTrackApi.API.Options;
using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("auth")]
public class AuthController(
    IUserRepository userRepo,
    AppDbContext db,
    IOptions<JwtOptions> jwtOpts) : ControllerBase
{
    private readonly JwtOptions _jwt = jwtOpts.Value;

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        if (await userRepo.ExistsByEmailAsync(req.Email))
            return Conflict(new { message = "Cet email est déjà utilisé." });

        var user = new User
        {
            Email = req.Email.ToLower(),
            Pseudo = req.Pseudo,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            HeightCm = req.HeightCm,
            WeightKg = req.WeightKg,
        };
        await userRepo.AddAsync(user);
        return Ok(new { message = "Compte créé avec succès." });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var user = await userRepo.GetByEmailAsync(req.Email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email ou mot de passe incorrect." });

        var accessToken = GenerateAccessToken(user);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(7),
        });

        return Ok(new AuthResponse(accessToken, ToDto(user)));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<RefreshResponse>> Refresh()
    {
        var tokenValue = Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(tokenValue))
            return Unauthorized();

        var token = await db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == tokenValue && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow);

        if (token is null)
            return Unauthorized();

        token.IsRevoked = true;
        var newRefresh = await CreateRefreshTokenAsync(token.UserId);
        await db.SaveChangesAsync();

        Response.Cookies.Append("refresh_token", newRefresh, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(7),
        });

        return Ok(new RefreshResponse(GenerateAccessToken(token.User)));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var tokenValue = Request.Cookies["refresh_token"];
        if (!string.IsNullOrEmpty(tokenValue))
        {
            var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == tokenValue);
            if (token is not null) { token.IsRevoked = true; await db.SaveChangesAsync(); }
        }
        Response.Cookies.Delete("refresh_token");
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var userId = Guid.Parse(User.FindFirstValue("sub")!);
        var user = await userRepo.GetByIdAsync(userId);
        return user is null ? NotFound() : Ok(ToDto(user));
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> UpdateProfile(UpdateProfileRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue("sub")!);
        var user = await userRepo.GetByIdAsync(userId);
        if (user is null) return NotFound();

        if (!string.IsNullOrEmpty(req.Pseudo)) user.Pseudo = req.Pseudo;
        if (req.HeightCm.HasValue) user.HeightCm = req.HeightCm;
        if (req.WeightKg.HasValue) user.WeightKg = req.WeightKg;
        if (req.Ftp.HasValue) user.Ftp = req.Ftp;
        if (req.MaxHrBpm.HasValue) user.MaxHrBpm = req.MaxHrBpm;
        if (!string.IsNullOrEmpty(req.Goal)) user.Goal = req.Goal;
        await userRepo.UpdateAsync(user);
        return Ok(ToDto(user));
    }

    private string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim("sub", user.Id.ToString()),
            new Claim("email", user.Email),
            new Claim("pseudo", user.Pseudo),
            new Claim("role", user.Role),
        };
        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId)
    {
        var value = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            Token = value,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
        });
        await db.SaveChangesAsync();
        return value;
    }

    private static UserDto ToDto(User u) => new(u.Id, u.Email, u.Pseudo, u.Role, u.HeightCm, u.WeightKg, u.Ftp, u.MaxHrBpm, u.Goal);
}
