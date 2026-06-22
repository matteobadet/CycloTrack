using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CycloTrackApi.Infrastructure.Migrations
{
    public partial class AddRideFeedbackAfter : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FeelAfter",
                table: "Rides",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CommentAfter",
                table: "Rides",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "FeelAfter", table: "Rides");
            migrationBuilder.DropColumn(name: "CommentAfter", table: "Rides");
        }
    }
}
