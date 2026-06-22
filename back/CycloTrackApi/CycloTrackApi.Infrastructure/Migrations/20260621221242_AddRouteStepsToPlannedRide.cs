using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CycloTrackApi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRouteStepsToPlannedRide : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ElevationJson",
                table: "PlannedRides",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RouteStepsJson",
                table: "PlannedRides",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ElevationJson",
                table: "PlannedRides");

            migrationBuilder.DropColumn(
                name: "RouteStepsJson",
                table: "PlannedRides");
        }
    }
}
