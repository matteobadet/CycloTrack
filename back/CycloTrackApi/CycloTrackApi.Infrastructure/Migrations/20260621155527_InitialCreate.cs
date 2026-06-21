using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CycloTrackApi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Pseudo = table.Column<string>(type: "text", nullable: false),
                    HeightCm = table.Column<int>(type: "integer", nullable: true),
                    WeightKg = table.Column<float>(type: "real", nullable: true),
                    Role = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Follows",
                columns: table => new
                {
                    FollowerId = table.Column<Guid>(type: "uuid", nullable: false),
                    FollowedId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Follows", x => new { x.FollowerId, x.FollowedId });
                    table.ForeignKey(
                        name: "FK_Follows_Users_FollowedId",
                        column: x => x.FollowedId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Follows_Users_FollowerId",
                        column: x => x.FollowerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Goals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Period = table.Column<int>(type: "integer", nullable: false),
                    TargetValue = table.Column<float>(type: "real", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsAchieved = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Goals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Goals_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Rides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DistanceKm = table.Column<float>(type: "real", nullable: false),
                    DurationSec = table.Column<int>(type: "integer", nullable: false),
                    ElevationGainM = table.Column<float>(type: "real", nullable: false),
                    ElevationLossM = table.Column<float>(type: "real", nullable: false),
                    AvgSpeedKmh = table.Column<float>(type: "real", nullable: false),
                    MaxSpeedKmh = table.Column<float>(type: "real", nullable: false),
                    AvgWatts = table.Column<float>(type: "real", nullable: true),
                    MaxWatts = table.Column<float>(type: "real", nullable: true),
                    AvgCadenceRpm = table.Column<float>(type: "real", nullable: true),
                    AvgBpm = table.Column<int>(type: "integer", nullable: true),
                    MaxBpm = table.Column<int>(type: "integer", nullable: true),
                    CaloriesBurned = table.Column<float>(type: "real", nullable: false),
                    FeelBefore = table.Column<int>(type: "integer", nullable: true),
                    CommentBefore = table.Column<string>(type: "text", nullable: true),
                    AiAnalysis = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rides_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RidePoints",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RideId = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: false),
                    Lng = table.Column<double>(type: "double precision", nullable: false),
                    AltitudeM = table.Column<float>(type: "real", nullable: true),
                    SpeedKmh = table.Column<float>(type: "real", nullable: true),
                    Watts = table.Column<float>(type: "real", nullable: true),
                    Bpm = table.Column<int>(type: "integer", nullable: true),
                    CadenceRpm = table.Column<float>(type: "real", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RidePoints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RidePoints_Rides_RideId",
                        column: x => x.RideId,
                        principalTable: "Rides",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Follows_FollowedId",
                table: "Follows",
                column: "FollowedId");

            migrationBuilder.CreateIndex(
                name: "IX_Goals_UserId",
                table: "Goals",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RidePoints_RideId",
                table: "RidePoints",
                column: "RideId");

            migrationBuilder.CreateIndex(
                name: "IX_Rides_UserId",
                table: "Rides",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Follows");

            migrationBuilder.DropTable(
                name: "Goals");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "RidePoints");

            migrationBuilder.DropTable(
                name: "Rides");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
