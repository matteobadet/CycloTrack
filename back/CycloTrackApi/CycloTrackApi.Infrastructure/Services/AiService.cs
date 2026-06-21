using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using Microsoft.Extensions.Configuration;

namespace CycloTrackApi.Infrastructure.Services;

public class AiService(IHttpClientFactory httpClientFactory) : IAiService
{
    public async Task<string> AnalyzeRideAsync(Ride ride, User user)
    {
        var prompt = BuildPrompt(ride, user);

        var client = httpClientFactory.CreateClient("Anthropic");
        var request = new
        {
            model = "claude-sonnet-4-6",
            max_tokens = 1024,
            messages = new[]
            {
                new { role = "user", content = prompt }
            }
        };

        var response = await client.PostAsJsonAsync("https://api.anthropic.com/v1/messages", request);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("content")[0].GetProperty("text").GetString() ?? string.Empty;
    }

    private static string BuildPrompt(Ride ride, User user)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Tu es un coach professionnel de cyclisme. Analyse cette sortie et donne des conseils personnalisés pour que la prochaine sortie soit encore meilleure.");
        sb.AppendLine();
        sb.AppendLine("Données du cycliste :");
        if (user.HeightCm.HasValue) sb.AppendLine($"- Taille : {user.HeightCm} cm");
        if (user.WeightKg.HasValue) sb.AppendLine($"- Poids : {user.WeightKg} kg");
        if (ride.FeelBefore.HasValue) sb.AppendLine($"- Ressenti avant sortie : {ride.FeelBefore}/5{(string.IsNullOrEmpty(ride.CommentBefore) ? "" : $" — \"{ride.CommentBefore}\"")}");
        sb.AppendLine();
        sb.AppendLine("Données de la sortie :");
        sb.AppendLine($"- Distance : {ride.DistanceKm:F1} km");
        var duration = TimeSpan.FromSeconds(ride.DurationSec);
        sb.AppendLine($"- Durée : {(int)duration.TotalHours}h{duration.Minutes:D2}");
        sb.AppendLine($"- Dénivelé positif : {ride.ElevationGainM:F0} m / négatif : {ride.ElevationLossM:F0} m");
        sb.AppendLine($"- Vitesse moyenne : {ride.AvgSpeedKmh:F1} km/h / max : {ride.MaxSpeedKmh:F1} km/h");
        if (ride.AvgWatts.HasValue) sb.AppendLine($"- Puissance moyenne : {ride.AvgWatts:F0} W / max : {ride.MaxWatts:F0} W");
        if (ride.AvgCadenceRpm.HasValue) sb.AppendLine($"- Cadence moyenne : {ride.AvgCadenceRpm:F0} rpm");
        if (ride.AvgBpm.HasValue) sb.AppendLine($"- Fréquence cardiaque moyenne : {ride.AvgBpm} bpm / max : {ride.MaxBpm} bpm");
        sb.AppendLine($"- Calories brûlées : {ride.CaloriesBurned:F0} kcal");
        sb.AppendLine();
        sb.AppendLine("Donne un bilan structuré : points positifs, points à améliorer, conseils concrets pour la prochaine sortie (entraînement, nutrition, récupération). Sois précis et bienveillant.");
        return sb.ToString();
    }
}
