namespace CycloTrackApi.Core.Entities;

public enum GoalType { Distance, Elevation, RideCount, Performance }
public enum GoalPeriod { Week, Month, Year }

public class Goal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public GoalType Type { get; set; }
    public GoalPeriod Period { get; set; }
    public float TargetValue { get; set; }
    public string? Description { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsAchieved { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
