using CycloTrackApi.Core.Entities;

namespace CycloTrackApi.Core.Interfaces;

public interface IGoalRepository
{
    Task<IEnumerable<Goal>> GetByUserIdAsync(Guid userId);
    Task<Goal?> GetByIdAsync(Guid id);
    Task AddAsync(Goal goal);
    Task UpdateAsync(Goal goal);
    Task DeleteAsync(Goal goal);
}
