using CycloTrackApi.Core.Entities;

namespace CycloTrackApi.Core.Interfaces;

public interface IRideRepository
{
    Task<Ride?> GetByIdAsync(Guid id);
    Task<IEnumerable<Ride>> GetByUserIdAsync(Guid userId, int page, int pageSize);
    Task<IEnumerable<Ride>> GetFeedAsync(IEnumerable<Guid> followedIds, int page, int pageSize);
    Task AddAsync(Ride ride);
    Task AddPointsAsync(IEnumerable<RidePoint> points);
    Task UpdateAsync(Ride ride);
    Task<IEnumerable<RidePoint>> GetPointsByRideIdAsync(Guid rideId);
}
