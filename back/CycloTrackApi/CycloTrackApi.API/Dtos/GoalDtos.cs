using CycloTrackApi.Core.Entities;

namespace CycloTrackApi.API.Dtos;

public record CreateGoalRequest(GoalType Type, GoalPeriod Period, float TargetValue, string? Description, DateTime StartDate, DateTime EndDate);
public record GoalDto(Guid Id, GoalType Type, GoalPeriod Period, float TargetValue, string? Description, DateTime StartDate, DateTime EndDate, bool IsAchieved, float CurrentValue);
