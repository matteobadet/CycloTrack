namespace CycloTrackApi.API.Dtos;

public record CreateRideRequest(
    DateTime StartedAt,
    DateTime EndedAt,
    float DistanceKm,
    int DurationSec,
    float ElevationGainM,
    float ElevationLossM,
    float AvgSpeedKmh,
    float MaxSpeedKmh,
    float? AvgWatts,
    float? MaxWatts,
    float? AvgCadenceRpm,
    int? AvgBpm,
    int? MaxBpm,
    float CaloriesBurned,
    int? FeelBefore,
    string? CommentBefore,
    List<RidePointRequest> Points
);

public record RidePointRequest(
    DateTime Timestamp,
    double Lat,
    double Lng,
    float? AltitudeM,
    float? SpeedKmh,
    float? Watts,
    int? Bpm,
    float? CadenceRpm
);

public record RideDto(
    Guid Id,
    Guid UserId,
    string UserPseudo,
    DateTime StartedAt,
    DateTime? EndedAt,
    float DistanceKm,
    int DurationSec,
    float ElevationGainM,
    float ElevationLossM,
    float AvgSpeedKmh,
    float MaxSpeedKmh,
    float? AvgWatts,
    float? MaxWatts,
    float? AvgCadenceRpm,
    int? AvgBpm,
    int? MaxBpm,
    float CaloriesBurned,
    int? FeelBefore,
    string? CommentBefore,
    string? AiAnalysis
);

public record RidePointDto(
    DateTime Timestamp,
    double Lat,
    double Lng,
    float? AltitudeM,
    float? SpeedKmh,
    float? Watts,
    int? Bpm,
    float? CadenceRpm
);

public record RideDetailDto(RideDto Ride, List<RidePointDto> Points, List<MusicInsightDto> MusicInsights, List<RideTrackDto> Tracks);

public record RideTrackDto(
    string TrackName,
    string ArtistName,
    string? AlbumArtUrl,
    float? Tempo,
    float? Energy,
    float? Valence,
    DateTime PolledAt,
    float? SpeedKmh,
    float? Watts,
    int? Bpm
);

public record MusicInsightDto(
    string Emoji,
    string Title,
    string Description,
    string TrackName,
    string ArtistName,
    string? AlbumArtUrl
);

public record PollTrackRequest(
    float? CurrentSpeedKmh,
    float? CurrentWatts,
    int? CurrentBpm,
    float? ElevDeltaM
);

public record SimplePointDto(double Lat, double Lng);
public record ReactionGroupDto(string Emoji, int Count, bool UserReacted);
public record CommentDto(Guid Id, Guid UserId, string UserPseudo, string Text, DateTime CreatedAt);
public record StoryUserDto(Guid UserId, string Pseudo, DateTime LastRideAt);

public record FeedRideDto(
    Guid Id,
    Guid UserId,
    string UserPseudo,
    DateTime StartedAt,
    DateTime? EndedAt,
    float DistanceKm,
    int DurationSec,
    float ElevationGainM,
    float ElevationLossM,
    float AvgSpeedKmh,
    float? AvgWatts,
    float CaloriesBurned,
    List<ReactionGroupDto> Reactions,
    int CommentCount,
    List<CommentDto> TopComments,
    List<SimplePointDto> Points
);

public record ReactRequest(string Emoji);
public record AddCommentRequest(string Text);
