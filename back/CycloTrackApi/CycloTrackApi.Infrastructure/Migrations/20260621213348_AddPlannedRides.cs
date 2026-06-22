using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CycloTrackApi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlannedRides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlannedRides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    PlannedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DistanceKm = table.Column<float>(type: "real", nullable: false),
                    ElevationGainM = table.Column<float>(type: "real", nullable: false),
                    ElevationLossM = table.Column<float>(type: "real", nullable: false),
                    EstimatedDurationMin = table.Column<int>(type: "integer", nullable: false),
                    RoutePolyline = table.Column<string>(type: "text", nullable: true),
                    AiAdvice = table.Column<string>(type: "text", nullable: true),
                    GoogleMapsUrl = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlannedRides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlannedRides_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlannedRides_UserId",
                table: "PlannedRides",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlannedRides");
        }
    }
}
