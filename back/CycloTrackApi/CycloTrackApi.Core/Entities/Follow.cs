namespace CycloTrackApi.Core.Entities;

public class Follow
{
    public Guid FollowerId { get; set; }
    public User Follower { get; set; } = null!;

    public Guid FollowedId { get; set; }
    public User Followed { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
