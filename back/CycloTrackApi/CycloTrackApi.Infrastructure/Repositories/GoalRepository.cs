using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CycloTrackApi.Infrastructure.Repositories;

public class GoalRepository(AppDbContext db) : IGoalRepository
{
    public async Task<IEnumerable<Goal>> GetByUserIdAsync(Guid userId) =>
        await db.Goals.Where(g => g.UserId == userId).OrderByDescending(g => g.CreatedAt).ToListAsync();

    public Task<Goal?> GetByIdAsync(Guid id) =>
        db.Goals.FirstOrDefaultAsync(g => g.Id == id);

    public async Task AddAsync(Goal goal)
    {
        db.Goals.Add(goal);
        await db.SaveChangesAsync();
    }

    public async Task UpdateAsync(Goal goal)
    {
        db.Goals.Update(goal);
        await db.SaveChangesAsync();
    }

    public async Task DeleteAsync(Goal goal)
    {
        db.Goals.Remove(goal);
        await db.SaveChangesAsync();
    }
}
