namespace CycloTrackApi.Core.Entities;

public enum NotificationType { Reaction, Comment, Follow, GoalAchieved }

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }          // destinataire
    public User User { get; set; } = null!;
    public NotificationType Type { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public Guid? RideId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
