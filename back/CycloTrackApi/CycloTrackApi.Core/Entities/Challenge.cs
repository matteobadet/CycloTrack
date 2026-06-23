namespace CycloTrackApi.Core.Entities;

public class Challenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CreatorId { get; set; }
    public User Creator { get; set; } = null!;

    public string Title { get; set; } = "";
    // "Distance" | "Elevation" | "Rides"
    public string Type { get; set; } = "Distance";
    public float TargetValue { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ChallengeParticipant> Participants { get; set; } = [];
}

public class ChallengeParticipant
{
    public Guid ChallengeId { get; set; }
    public Challenge Challenge { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
