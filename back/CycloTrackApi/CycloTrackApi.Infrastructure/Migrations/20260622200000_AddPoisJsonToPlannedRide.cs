using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CycloTrackApi.Infrastructure.Migrations
{
    public partial class AddPoisJsonToPlannedRide : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PoisJson",
                table: "PlannedRides",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PoisJson",
                table: "PlannedRides");
        }
    }
}
