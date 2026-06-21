namespace CycloTrackApi.API.Dtos;

public record RegisterRequest(string Email, string Pseudo, string Password, int? HeightCm, float? WeightKg);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string AccessToken, UserDto User);
public record RefreshResponse(string AccessToken);
public record UserDto(Guid Id, string Email, string Pseudo, string Role, int? HeightCm, float? WeightKg);
public record UpdateProfileRequest(string? Pseudo, int? HeightCm, float? WeightKg);
