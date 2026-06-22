namespace CycloTrackApi.Core.Entities;

public class PlannedRide
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Title { get; set; } = "";
    public DateTime? PlannedAt { get; set; }

    public float DistanceKm { get; set; }
    public float ElevationGainM { get; set; }
    public float ElevationLossM { get; set; }
    public int EstimatedDurationMin { get; set; }

    // Encoded polyline for route display
    public string? RoutePolyline { get; set; }

    public string? AiAdvice { get; set; }
    public string? GoogleMapsUrl { get; set; }
    // JSON: [{instruction, emoji, cumulativeM}]
    public string? RouteStepsJson { get; set; }
    // JSON: [{distKm, altM}]
    public string? ElevationJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsCompleted { get; set; } = false;
}
