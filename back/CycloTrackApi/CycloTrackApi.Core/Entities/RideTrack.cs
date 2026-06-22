namespace CycloTrackApi.Core.Entities;

public class RideTrack
{
    public long Id { get; set; }
    public Guid RideId { get; set; }
    public Ride Ride { get; set; } = null!;

    public string SpotifyTrackId { get; set; } = "";
    public string TrackName { get; set; } = "";
    public string ArtistName { get; set; } = "";
    public string? AlbumArtUrl { get; set; }

    // Audio features from Spotify
    public float? Tempo { get; set; }
    public float? Energy { get; set; }
    public float? Valence { get; set; }

    // When this 30s snapshot was taken
    public DateTime PolledAt { get; set; }

    // Ride metrics during this window
    public float? SpeedKmh { get; set; }
    public float? Watts { get; set; }
    public int? Bpm { get; set; }
    public float? ElevDeltaM { get; set; }
}
