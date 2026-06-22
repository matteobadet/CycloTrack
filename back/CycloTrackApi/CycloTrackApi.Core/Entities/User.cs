namespace CycloTrackApi.Core.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Pseudo { get; set; } = string.Empty;
    public int? HeightCm { get; set; }
    public float? WeightKg { get; set; }
    public string Role { get; set; } = "User";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int? Ftp { get; set; }
    public int? MaxHrBpm { get; set; }
    public string? Goal { get; set; } // "weight_loss" | "performance" | "endurance"

    public string? SpotifyRefreshToken { get; set; }
    public string? SpotifyAccessToken { get; set; }
    public DateTime? SpotifyTokenExpiresAt { get; set; }

    public ICollection<Ride> Rides { get; set; } = [];
    public ICollection<Goal> Goals { get; set; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public ICollection<Follow> Followers { get; set; } = [];
    public ICollection<Follow> Following { get; set; } = [];
}
