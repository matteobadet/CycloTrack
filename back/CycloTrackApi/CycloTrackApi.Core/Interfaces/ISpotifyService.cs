namespace CycloTrackApi.Core.Interfaces;

public interface ISpotifyService
{
    string GetAuthUrl(string redirectUri, string state);
    Task<SpotifyTokens> ExchangeCodeAsync(string code, string redirectUri);
    Task<string> RefreshAccessTokenAsync(string refreshToken);
    Task<SpotifyCurrentTrack?> GetCurrentlyPlayingAsync(string accessToken);
    Task<SpotifyAudioFeatures?> GetAudioFeaturesAsync(string accessToken, string trackId);
}

public record SpotifyTokens(string AccessToken, string RefreshToken, DateTime ExpiresAt);
public record SpotifyCurrentTrack(string Id, string TrackName, string ArtistName, string? AlbumArtUrl);
public record SpotifyAudioFeatures(float Tempo, float Energy, float Valence);
