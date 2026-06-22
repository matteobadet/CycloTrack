namespace CycloTrackApi.Core.Entities;

public class Ride
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }

    public float DistanceKm { get; set; }
    public int DurationSec { get; set; }
    public float ElevationGainM { get; set; }
    public float ElevationLossM { get; set; }

    public float AvgSpeedKmh { get; set; }
    public float MaxSpeedKmh { get; set; }

    public float? AvgWatts { get; set; }
    public float? MaxWatts { get; set; }
    public float? AvgCadenceRpm { get; set; }

    public int? AvgBpm { get; set; }
    public int? MaxBpm { get; set; }

    public float CaloriesBurned { get; set; }

    public int? FeelBefore { get; set; }
    public string? CommentBefore { get; set; }

    public int? FeelAfter { get; set; }
    public string? CommentAfter { get; set; }

    public string? AiAnalysis { get; set; }

    public ICollection<RidePoint> Points { get; set; } = [];
    public ICollection<RideTrack> Tracks { get; set; } = [];
    public ICollection<Comment> Comments { get; set; } = [];
    public ICollection<Reaction> Reactions { get; set; } = [];
}
