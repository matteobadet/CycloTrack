using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CycloTrackApi.Core.Interfaces;
using Microsoft.Extensions.Configuration;

namespace CycloTrackApi.Infrastructure.Services;

public class SpotifyService(IHttpClientFactory httpClientFactory, IConfiguration config) : ISpotifyService
{
    private string ClientId => config["Spotify:ClientId"]!;
    private string ClientSecret => config["Spotify:ClientSecret"]!;

    public string GetAuthUrl(string redirectUri, string state)
    {
        var scopes = "user-read-currently-playing user-read-playback-state";
        return $"https://accounts.spotify.com/authorize" +
               $"?client_id={ClientId}" +
               $"&response_type=code" +
               $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
               $"&scope={Uri.EscapeDataString(scopes)}" +
               $"&state={Uri.EscapeDataString(state)}";
    }

    public async Task<SpotifyTokens> ExchangeCodeAsync(string code, string redirectUri)
    {
        var client = httpClientFactory.CreateClient();
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        var form = new FormUrlEncodedContent([
            new("grant_type", "authorization_code"),
            new("code", code),
            new("redirect_uri", redirectUri),
        ]);

        var response = await client.PostAsync("https://accounts.spotify.com/api/token", form);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = json.GetProperty("access_token").GetString()!;
        var refreshToken = json.GetProperty("refresh_token").GetString()!;
        var expiresIn = json.GetProperty("expires_in").GetInt32();

        return new SpotifyTokens(accessToken, refreshToken, DateTime.UtcNow.AddSeconds(expiresIn - 60));
    }

    public async Task<string> RefreshAccessTokenAsync(string refreshToken)
    {
        var client = httpClientFactory.CreateClient();
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        var form = new FormUrlEncodedContent([
            new("grant_type", "refresh_token"),
            new("refresh_token", refreshToken),
        ]);

        var response = await client.PostAsync("https://accounts.spotify.com/api/token", form);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("access_token").GetString()!;
    }

    public async Task<SpotifyCurrentTrack?> GetCurrentlyPlayingAsync(string accessToken)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await client.GetAsync("https://api.spotify.com/v1/me/player/currently-playing");
        if (response.StatusCode == System.Net.HttpStatusCode.NoContent) return null;
        if (!response.IsSuccessStatusCode) return null;

        var content = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(content)) return null;

        var json = JsonDocument.Parse(content).RootElement;
        if (!json.TryGetProperty("item", out var item) || item.ValueKind == JsonValueKind.Null) return null;
        if (!json.TryGetProperty("is_playing", out var isPlaying) || !isPlaying.GetBoolean()) return null;

        var trackId = item.GetProperty("id").GetString()!;
        var trackName = item.GetProperty("name").GetString()!;
        var artistName = item.GetProperty("artists")[0].GetProperty("name").GetString()!;
        string? albumArtUrl = null;
        if (item.TryGetProperty("album", out var album) &&
            album.TryGetProperty("images", out var images) &&
            images.GetArrayLength() > 0)
        {
            albumArtUrl = images[0].GetProperty("url").GetString();
        }

        return new SpotifyCurrentTrack(trackId, trackName, artistName, albumArtUrl);
    }

    public async Task<SpotifyAudioFeatures?> GetAudioFeaturesAsync(string accessToken, string trackId)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await client.GetAsync($"https://api.spotify.com/v1/audio-features/{trackId}");
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var tempo = json.GetProperty("tempo").GetSingle();
        var energy = json.GetProperty("energy").GetSingle();
        var valence = json.GetProperty("valence").GetSingle();

        return new SpotifyAudioFeatures(tempo, energy, valence);
    }
}
