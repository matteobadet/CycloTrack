using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CycloTrackApi.Infrastructure.Repositories;

public class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> GetByIdAsync(Guid id) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id);

    public Task<User?> GetByEmailAsync(string email) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == email.ToLower());

    public Task<bool> ExistsByEmailAsync(string email) =>
        db.Users.AnyAsync(u => u.Email == email.ToLower());

    public async Task AddAsync(User user)
    {
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    public async Task UpdateAsync(User user)
    {
        db.Users.Update(user);
        await db.SaveChangesAsync();
    }
}
