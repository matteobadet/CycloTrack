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

public record RideDetailDto(RideDto Ride, List<RidePointDto> Points);
