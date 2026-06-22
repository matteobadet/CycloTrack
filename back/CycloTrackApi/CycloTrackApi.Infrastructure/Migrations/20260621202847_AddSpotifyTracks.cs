using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CycloTrackApi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSpotifyTracks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SpotifyAccessToken",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SpotifyRefreshToken",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SpotifyTokenExpiresAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RideTracks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RideId = table.Column<Guid>(type: "uuid", nullable: false),
                    SpotifyTrackId = table.Column<string>(type: "text", nullable: false),
                    TrackName = table.Column<string>(type: "text", nullable: false),
                    ArtistName = table.Column<string>(type: "text", nullable: false),
                    AlbumArtUrl = table.Column<string>(type: "text", nullable: true),
                    Tempo = table.Column<float>(type: "real", nullable: true),
                    Energy = table.Column<float>(type: "real", nullable: true),
                    Valence = table.Column<float>(type: "real", nullable: true),
                    PolledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SpeedKmh = table.Column<float>(type: "real", nullable: true),
                    Watts = table.Column<float>(type: "real", nullable: true),
                    Bpm = table.Column<int>(type: "integer", nullable: true),
                    ElevDeltaM = table.Column<float>(type: "real", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RideTracks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RideTracks_Rides_RideId",
                        column: x => x.RideId,
                        principalTable: "Rides",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RideTracks_RideId",
                table: "RideTracks",
                column: "RideId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RideTracks");

            migrationBuilder.DropColumn(
                name: "SpotifyAccessToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SpotifyRefreshToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SpotifyTokenExpiresAt",
                table: "Users");
        }
    }
}
