using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CycloTrackApi.Infrastructure.Repositories;

public class RideRepository(AppDbContext db) : IRideRepository
{
    public Task<Ride?> GetByIdAsync(Guid id) =>
        db.Rides.Include(r => r.User).FirstOrDefaultAsync(r => r.Id == id);

    public async Task<IEnumerable<Ride>> GetByUserIdAsync(Guid userId, int page, int pageSize) =>
        await db.Rides
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

    public async Task<IEnumerable<Ride>> GetFeedAsync(IEnumerable<Guid> followedIds, int page, int pageSize) =>
        await db.Rides
            .Include(r => r.User)
            .Where(r => followedIds.Contains(r.UserId))
            .OrderByDescending(r => r.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

    public async Task AddAsync(Ride ride)
    {
        db.Rides.Add(ride);
        await db.SaveChangesAsync();
    }

    public async Task AddPointsAsync(IEnumerable<RidePoint> points)
    {
        db.RidePoints.AddRange(points);
        await db.SaveChangesAsync();
    }

    public async Task UpdateAsync(Ride ride)
    {
        db.Rides.Update(ride);
        await db.SaveChangesAsync();
    }

    public async Task<IEnumerable<RidePoint>> GetPointsByRideIdAsync(Guid rideId) =>
        await db.RidePoints
            .Where(p => p.RideId == rideId)
            .OrderBy(p => p.Timestamp)
            .ToListAsync();
}
