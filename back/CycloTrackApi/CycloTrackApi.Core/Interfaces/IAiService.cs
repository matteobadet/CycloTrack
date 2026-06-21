using CycloTrackApi.Core.Entities;

namespace CycloTrackApi.Core.Interfaces;

public interface IAiService
{
    Task<string> AnalyzeRideAsync(Ride ride, User user);
}
