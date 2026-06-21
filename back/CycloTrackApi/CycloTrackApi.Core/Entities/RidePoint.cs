namespace CycloTrackApi.Core.Entities;

public class RidePoint
{
    public long Id { get; set; }
    public Guid RideId { get; set; }
    public Ride Ride { get; set; } = null!;

    public DateTime Timestamp { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public float? AltitudeM { get; set; }
    public float? SpeedKmh { get; set; }
    public float? Watts { get; set; }
    public int? Bpm { get; set; }
    public float? CadenceRpm { get; set; }
}
