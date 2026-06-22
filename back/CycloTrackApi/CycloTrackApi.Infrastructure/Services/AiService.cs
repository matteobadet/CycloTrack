using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;

namespace CycloTrackApi.Infrastructure.Services;

public class AiService(IHttpClientFactory httpClientFactory) : IAiService
{
    public async Task<string> AnalyzeRideAsync(Ride ride, User user, IEnumerable<RideTrack>? tracks = null)
    {
        var client = httpClientFactory.CreateClient("Groq");
        var request = new
        {
            model = "llama-3.3-70b-versatile",
            max_tokens = 1200,
            messages = new[]
            {
                new { role = "user", content = BuildPrompt(ride, user, tracks?.ToList()) }
            }
        };

        var response = await client.PostAsJsonAsync("https://api.groq.com/openai/v1/chat/completions", request);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Groq API error {(int)response.StatusCode}: {errorBody}");
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
    }

    private static string BuildPrompt(Ride ride, User user, List<RideTrack>? tracks)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Tu es un coach professionnel de cyclisme et nutritionniste sportif. Analyse cette sortie et donne des conseils PERSONNALISÉS et PRÉCIS, notamment sur la nutrition. Évite les conseils génériques — base-toi sur les données réelles du cycliste.");
        sb.AppendLine();

        // --- Profil cycliste ---
        sb.AppendLine("## Profil du cycliste");
        if (user.HeightCm.HasValue) sb.AppendLine($"- Taille : {user.HeightCm} cm");
        if (user.WeightKg.HasValue) sb.AppendLine($"- Poids : {user.WeightKg} kg");
        if (user.Ftp.HasValue) sb.AppendLine($"- FTP : {user.Ftp} W");
        if (user.MaxHrBpm.HasValue) sb.AppendLine($"- FC max : {user.MaxHrBpm} bpm");

        var goalLabel = user.Goal switch
        {
            "weight_loss" => "Perte de poids",
            "performance" => "Amélioration des performances",
            "endurance" => "Développement de l'endurance",
            _ => null
        };
        if (goalLabel != null) sb.AppendLine($"- Objectif : {goalLabel}");

        // --- Contexte de la sortie ---
        sb.AppendLine();
        sb.AppendLine("## Contexte de la sortie");
        var localHour = ride.StartedAt.Hour; // UTC, assume ~UTC+2 en été
        var hourLocal = (localHour + 2) % 24;
        var momentJournee = hourLocal switch
        {
            < 9 => "tôt le matin (sortie probablement à jeun ou avec un petit-déjeuner léger)",
            < 12 => "en matinée",
            < 14 => "en milieu de journée (après le déjeuner)",
            < 18 => "en après-midi",
            _ => "en soirée"
        };
        sb.AppendLine($"- Heure de départ : {hourLocal}h ({momentJournee})");
        if (ride.FeelBefore.HasValue)
            sb.AppendLine($"- Ressenti avant : {ride.FeelBefore}/5{(string.IsNullOrEmpty(ride.CommentBefore) ? "" : $" — \"{ride.CommentBefore}\"")}");

        // --- Données de la sortie ---
        sb.AppendLine();
        sb.AppendLine("## Données de la sortie");
        var duration = TimeSpan.FromSeconds(ride.DurationSec);
        sb.AppendLine($"- Distance : {ride.DistanceKm:F1} km");
        sb.AppendLine($"- Durée : {(int)duration.TotalHours}h{duration.Minutes:D2}");
        sb.AppendLine($"- Dénivelé + : {ride.ElevationGainM:F0} m / - : {ride.ElevationLossM:F0} m");
        sb.AppendLine($"- Vitesse moy. : {ride.AvgSpeedKmh:F1} km/h / max : {ride.MaxSpeedKmh:F1} km/h");

        if (ride.AvgWatts.HasValue)
        {
            sb.AppendLine($"- Puissance moy. : {ride.AvgWatts:F0} W / max : {ride.MaxWatts:F0} W");
            if (user.Ftp.HasValue && user.Ftp > 0)
            {
                var pctFtp = ride.AvgWatts.Value / user.Ftp.Value * 100;
                var zone = pctFtp switch
                {
                    < 56 => "Zone 1 — récupération active",
                    < 76 => "Zone 2 — endurance de base",
                    < 91 => "Zone 3 — tempo",
                    < 106 => "Zone 4 — seuil lactique",
                    < 121 => "Zone 5 — VO2max",
                    _ => "Zone 6/7 — anaérobie / neuromuscular"
                };
                sb.AppendLine($"- Intensité relative FTP : {pctFtp:F0}% → {zone}");
            }
        }

        if (ride.AvgBpm.HasValue)
        {
            sb.AppendLine($"- FC moy. : {ride.AvgBpm} bpm / max : {ride.MaxBpm} bpm");
            if (user.MaxHrBpm.HasValue && user.MaxHrBpm > 0)
            {
                var pctHr = ride.AvgBpm.Value / (float)user.MaxHrBpm.Value * 100;
                var zoneHr = pctHr switch
                {
                    < 60 => "Zone 1 — très légère",
                    < 70 => "Zone 2 — légère (lipides dominants)",
                    < 80 => "Zone 3 — modérée (mix lipides/glucides)",
                    < 90 => "Zone 4 — difficile (glucides dominants)",
                    _ => "Zone 5 — maximale"
                };
                sb.AppendLine($"- Intensité relative FC max : {pctHr:F0}% → {zoneHr}");
            }
        }

        if (ride.AvgCadenceRpm.HasValue) sb.AppendLine($"- Cadence moy. : {ride.AvgCadenceRpm:F0} rpm");
        sb.AppendLine($"- Calories brûlées : {ride.CaloriesBurned:F0} kcal");

        // Estimation glucides utilisés
        if (ride.AvgWatts.HasValue && user.Ftp.HasValue)
        {
            var pctFtp = ride.AvgWatts.Value / user.Ftp.Value * 100;
            // >75% FTP → glucides dominants ~50-70g/h, <75% → mix ~30-40g/h
            var carbsPerHour = pctFtp >= 75 ? 60 : 35;
            var totalCarbsG = (int)(carbsPerHour * duration.TotalHours);
            sb.AppendLine($"- Glucides estimés consommés : ~{totalCarbsG} g (base {carbsPerHour} g/h à cette intensité)");
        }

        // --- Musique ---
        if (tracks is { Count: > 0 })
        {
            var grouped = tracks
                .GroupBy(t => t.SpotifyTrackId)
                .Select(g => new
                {
                    g.First().TrackName,
                    g.First().ArtistName,
                    g.First().Tempo,
                    g.First().Energy,
                    AvgWatts = g.Where(x => x.Watts.HasValue).Select(x => x.Watts!.Value).DefaultIfEmpty(0).Average(),
                    AvgSpeed = g.Where(x => x.SpeedKmh.HasValue).Select(x => x.SpeedKmh!.Value).DefaultIfEmpty(0).Average(),
                    Count = g.Count(),
                })
                .OrderByDescending(g => g.Count)
                .Take(5)
                .ToList();

            sb.AppendLine();
            sb.AppendLine("## Musique (top 5 par temps d'écoute)");
            foreach (var t in grouped)
            {
                sb.Append($"- \"{t.TrackName}\" de {t.ArtistName}");
                if (t.AvgWatts > 0) sb.Append($" → {t.AvgWatts:F0} W moy.");
                if (t.AvgSpeed > 0) sb.Append($", {t.AvgSpeed:F1} km/h moy.");
                if (t.Tempo.HasValue) sb.Append($", {t.Tempo:F0} BPM");
                sb.AppendLine();
            }
            sb.AppendLine("Mentionne brièvement l'impact de la musique si pertinent.");
        }

        // --- Consignes pour la réponse ---
        sb.AppendLine();
        sb.AppendLine("## Instructions pour ta réponse");
        sb.AppendLine("Structure ta réponse en 3 sections : **Points positifs**, **Points à améliorer**, **Conseils pour la prochaine sortie**.");
        sb.AppendLine("Pour la section nutrition, sois TRÈS PRÉCIS :");
        sb.AppendLine("- Indique des quantités concrètes (grammes, millilitres, nombre d'unités)");
        sb.AppendLine("- Adapte les conseils à l'heure de la sortie et à l'objectif du cycliste");

        if (user.Goal == "weight_loss")
            sb.AppendLine("- L'objectif est la perte de poids : calcule le déficit calorique réel et propose des ajustements alimentaires précis sans compromettre la performance");
        else if (user.Goal == "performance")
            sb.AppendLine("- L'objectif est la performance : maximise la récupération et la surcompensation glycogénique avec des quantités précises");
        else if (user.Goal == "endurance")
            sb.AppendLine("- L'objectif est l'endurance : optimise l'oxydation des lipides et propose des stratégies de periodisation nutritionnelle");

        if (user.Ftp.HasValue && ride.AvgWatts.HasValue)
            sb.AppendLine($"- Adapte les conseils à l'intensité réelle de {ride.AvgWatts / user.Ftp * 100:F0}% FTP");

        return sb.ToString();
    }
}
