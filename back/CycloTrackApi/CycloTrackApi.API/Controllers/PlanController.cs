using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using CycloTrackApi.Core.Entities;
using CycloTrackApi.Core.Interfaces;
using CycloTrackApi.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CycloTrackApi.API.Controllers;

[ApiController]
[Route("plan")]
[Authorize]
public class PlanController(IUserRepository userRepo, IHttpClientFactory httpClientFactory, AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet("elevation")]
    [AllowAnonymous]
    public async Task<IActionResult> Elevation([FromQuery] string locations)
    {
        var client = httpClientFactory.CreateClient();
        var res = await client.GetAsync($"https://api.opentopodata.org/v1/srtm30m?locations={locations}");
        if (!res.IsSuccessStatusCode) return StatusCode(502, new { error = "Elevation API error" });
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        return Ok(json);
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var plans = await db.PlannedRides
            .Where(p => p.UserId == UserId)
            .OrderByDescending(p => p.PlannedAt ?? p.CreatedAt)
            .Select(p => new PlannedRideDto(p.Id, p.Title, p.PlannedAt, p.DistanceKm, p.ElevationGainM, p.ElevationLossM, p.EstimatedDurationMin, p.IsCompleted, p.CreatedAt))
            .ToListAsync();
        return Ok(plans);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var plan = await db.PlannedRides.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (plan is null) return NotFound();
        return Ok(MapDetail(plan));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var plan = await db.PlannedRides.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (plan is null) return NotFound();
        db.PlannedRides.Remove(plan);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id)
    {
        var plan = await db.PlannedRides.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (plan is null) return NotFound();
        plan.IsCompleted = true;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePlanRequest req)
    {
        var plan = await db.PlannedRides.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (plan is null) return NotFound();
        plan.Title = req.Title;
        plan.PlannedAt = req.PlannedAt;
        if (req.RoutePolyline != null) plan.RoutePolyline = req.RoutePolyline;
        if (req.DistanceKm.HasValue) plan.DistanceKm = req.DistanceKm.Value;
        if (req.ElevationGainM.HasValue) plan.ElevationGainM = req.ElevationGainM.Value;
        if (req.ElevationLossM.HasValue) plan.ElevationLossM = req.ElevationLossM.Value;
        if (req.EstimatedDurationMin.HasValue) plan.EstimatedDurationMin = req.EstimatedDurationMin.Value;
        if (req.PoisJson != null) plan.PoisJson = req.PoisJson;
        if (req.AiAdvice != null) plan.AiAdvice = req.AiAdvice;
        await db.SaveChangesAsync();
        return Ok(MapDetail(plan));
    }

    [HttpPost("{id:guid}/duplicate")]
    public async Task<IActionResult> Duplicate(Guid id)
    {
        var src = await db.PlannedRides.FirstOrDefaultAsync(p => p.Id == id && p.UserId == UserId);
        if (src is null) return NotFound();
        var copy = new PlannedRide
        {
            UserId = UserId,
            Title = src.Title + " (copie)",
            PlannedAt = null,
            DistanceKm = src.DistanceKm,
            ElevationGainM = src.ElevationGainM,
            ElevationLossM = src.ElevationLossM,
            EstimatedDurationMin = src.EstimatedDurationMin,
            RoutePolyline = src.RoutePolyline,
            GoogleMapsUrl = src.GoogleMapsUrl,
            AiAdvice = src.AiAdvice,
            RouteStepsJson = src.RouteStepsJson,
            ElevationJson = src.ElevationJson,
            IsCompleted = false,
        };
        db.PlannedRides.Add(copy);
        await db.SaveChangesAsync();
        return Ok(new { id = copy.Id });
    }

    // POST /plan/ai — generate AI advice only (no save)
    [HttpPost("ai")]
    public async Task<IActionResult> GenerateAi([FromBody] PlanRequest req)
    {
        var user = await userRepo.GetByIdAsync(UserId);
        if (user is null) return NotFound();

        // Fetch recent rides for fatigue context
        var recentRides = await db.Rides
            .Where(r => r.UserId == UserId && r.StartedAt >= DateTime.UtcNow.AddDays(-21))
            .OrderByDescending(r => r.StartedAt)
            .Take(5)
            .Select(r => new { r.StartedAt, r.DistanceKm, r.ElevationGainM, r.DurationSec })
            .ToListAsync();

        // Fetch weather if planned date is set and start coords provided
        WeatherInfo? weather = null;
        if (req.PlannedAt.HasValue && req.StartLat.HasValue && req.StartLng.HasValue)
        {
            var daysAhead = (req.PlannedAt.Value - DateTime.UtcNow).TotalDays;
            if (daysAhead >= 0 && daysAhead <= 15)
            {
                try
                {
                    var client2 = httpClientFactory.CreateClient();
                    var date = req.PlannedAt.Value.ToUniversalTime().ToString("yyyy-MM-dd");
                    var weatherUrl = $"https://api.open-meteo.com/v1/forecast?latitude={req.StartLat:F4}&longitude={req.StartLng:F4}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&timezone=auto&start_date={date}&end_date={date}";
                    var wResp = await client2.GetAsync(weatherUrl);
                    if (wResp.IsSuccessStatusCode)
                    {
                        var wJson = await wResp.Content.ReadFromJsonAsync<JsonElement>();
                        var daily = wJson.GetProperty("daily");
                        weather = new WeatherInfo(
                            (float)daily.GetProperty("temperature_2m_min").EnumerateArray().First().GetDouble(),
                            (float)daily.GetProperty("temperature_2m_max").EnumerateArray().First().GetDouble(),
                            (float)daily.GetProperty("windspeed_10m_max").EnumerateArray().First().GetDouble(),
                            (float)daily.GetProperty("precipitation_probability_max").EnumerateArray().First().GetDouble()
                        );
                    }
                }
                catch { /* weather is optional */ }
            }
        }

        var client = httpClientFactory.CreateClient("Groq");
        var prompt = BuildPrompt(req, user, recentRides.Select(r => new RecentRide(r.StartedAt, r.DistanceKm, r.ElevationGainM, r.DurationSec)).ToList(), weather);

        var groqReq = new
        {
            model = "llama-3.3-70b-versatile",
            max_tokens = 3000,
            messages = new[] { new { role = "user", content = prompt } }
        };

        var response = await client.PostAsJsonAsync("https://api.groq.com/openai/v1/chat/completions", groqReq);
        if (!response.IsSuccessStatusCode)
            return StatusCode(503, new { error = "Service IA indisponible." });

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var advice = json.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
        return Ok(new { advice });
    }

    // POST /plan/save — save planned ride (with or without AI advice)
    [HttpPost("save")]
    public async Task<IActionResult> Save([FromBody] SavePlanRequest req)
    {
        var plan = new PlannedRide
        {
            UserId = UserId,
            Title = req.Title,
            PlannedAt = req.PlannedAt,
            DistanceKm = req.DistanceKm,
            ElevationGainM = req.ElevationGainM,
            ElevationLossM = req.ElevationLossM,
            EstimatedDurationMin = req.EstimatedDurationMin,
            RoutePolyline = req.RoutePolyline,
            GoogleMapsUrl = req.GoogleMapsUrl,
            AiAdvice = req.AiAdvice,
            RouteStepsJson = req.RouteStepsJson,
            ElevationJson = req.ElevationJson,
            PoisJson = req.PoisJson,
        };
        db.PlannedRides.Add(plan);
        await db.SaveChangesAsync();
        return Ok(new { id = plan.Id });
    }

    private static string BuildPrompt(PlanRequest req, User user, List<RecentRide> recentRides, WeatherInfo? weather)
    {
        var sb = new StringBuilder();

        var difficultyLabel = req.Difficulty switch
        {
            "beginner" => "Débutant",
            "medium" => "Intermédiaire",
            "hard" => "Difficile",
            "pro" => "Pro / Compétition",
            _ => "Intermédiaire"
        };

        sb.AppendLine($"Tu es un coach cycliste professionnel. Un cycliste de niveau **{difficultyLabel}** veut préparer une sortie. Donne-lui un plan CONCRET, PERSONNALISÉ et STRUCTURÉ PAR ÉTAPES.");
        sb.AppendLine();

        // ── Profil cycliste ──
        sb.AppendLine("## Profil du cycliste");
        if (user.WeightKg.HasValue) sb.AppendLine($"- Poids : {user.WeightKg} kg");
        if (user.HeightCm.HasValue) sb.AppendLine($"- Taille : {user.HeightCm} cm");
        if (user.Ftp.HasValue) sb.AppendLine($"- FTP : {user.Ftp} W");
        if (user.MaxHrBpm.HasValue) sb.AppendLine($"- FC max : {user.MaxHrBpm} bpm");
        var goalLabel = user.Goal switch { "weight_loss" => "Perte de poids", "performance" => "Performance", "endurance" => "Endurance", _ => null };
        if (goalLabel != null) sb.AppendLine($"- Objectif général : {goalLabel}");
        sb.AppendLine($"- Niveau pour cette sortie : **{difficultyLabel}**");

        // ── Charge d'entraînement récente ──
        if (recentRides.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("## Charge d'entraînement des 21 derniers jours");
            var totalDist = recentRides.Sum(r => r.DistanceKm);
            var totalElev = recentRides.Sum(r => r.ElevationGainM);
            sb.AppendLine($"- {recentRides.Count} sortie(s) · {totalDist:F0} km · {totalElev:F0} m D+");
            foreach (var r in recentRides)
            {
                var daysAgo = (int)(DateTime.UtcNow - r.StartedAt).TotalDays;
                var durationH = r.DurationSec / 3600.0;
                sb.AppendLine($"  · Il y a {daysAgo}j : {r.DistanceKm:F0} km, +{r.ElevationGainM:F0} m, {durationH:F1}h");
            }
            // Fatigue estimation
            var lastRideDays = (int)(DateTime.UtcNow - recentRides[0].StartedAt).TotalDays;
            if (lastRideDays == 0) sb.AppendLine("- ⚠️ Dernière sortie aujourd'hui — récupération à surveiller");
            else if (lastRideDays == 1) sb.AppendLine("- Dernière sortie hier — jambes potentiellement fatiguées");
            else if (lastRideDays >= 7) sb.AppendLine("- Pas de sortie depuis 1 semaine — jambes fraîches");
        }
        else
        {
            sb.AppendLine();
            sb.AppendLine("## Charge d'entraînement récente");
            sb.AppendLine("- Aucune sortie enregistrée dans les 21 derniers jours (débutant ou reprise)");
        }

        // ── Météo ──
        if (weather != null)
        {
            sb.AppendLine();
            sb.AppendLine("## Météo prévue au départ");
            sb.AppendLine($"- Température : {weather.TempMin:F0}°C → {weather.TempMax:F0}°C");
            sb.AppendLine($"- Vent max : {weather.WindKmh:F0} km/h");
            sb.AppendLine($"- Probabilité de pluie : {weather.PrecipPct:F0}%");
            if (weather.WindKmh >= 40) sb.AppendLine("- ⚠️ Vent fort — prévoir effort supplémentaire, adapter l'allure");
            if (weather.PrecipPct >= 60) sb.AppendLine("- ⚠️ Risque de pluie élevé — prévoir vêtements imperméables, prudence en descente");
            if (weather.TempMax >= 28) sb.AppendLine("- ⚠️ Chaleur — augmenter l'hydratation (+500 ml/h), partir tôt");
            if (weather.TempMin <= 5) sb.AppendLine("- ⚠️ Froid au départ — prévoir sous-vêtement thermique, gants");
        }

        // ── Itinéraire ──
        sb.AppendLine();
        sb.AppendLine("## Itinéraire");
        sb.AppendLine($"- Distance totale : {req.DistanceKm:F1} km");
        sb.AppendLine($"- Dénivelé positif : {req.ElevationGainM:F0} m / négatif : {req.ElevationLossM:F0} m");
        sb.AppendLine($"- Durée estimée : {req.EstimatedDurationMin / 60}h{req.EstimatedDurationMin % 60:D2}");

        if (req.PlannedAt.HasValue)
        {
            var local = req.PlannedAt.Value.ToLocalTime();
            sb.AppendLine($"- Départ : {local:dddd d MMMM yyyy} à {local:HH:mm}");
            var isWeekend = local.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            sb.AppendLine($"- Contexte : {(isWeekend ? "week-end" : "semaine")}");
        }

        var elevPer10km = req.ElevationGainM / (req.DistanceKm / 10);
        var profileType = elevPer10km switch { < 50 => "plat", < 150 => "vallonné", < 300 => "montagneux", _ => "très montagneux" };
        sb.AppendLine($"- Profil : {profileType} ({elevPer10km:F0} m/10km)");

        if (user.Ftp.HasValue)
        {
            var calories = (int)(req.DistanceKm * 35 + req.ElevationGainM * 10);
            var hoursEst = req.EstimatedDurationMin / 60.0;
            var carbsPerHour = elevPer10km > 100 ? 65 : 45;
            sb.AppendLine($"- Dépense calorique estimée : ~{calories} kcal");
            sb.AppendLine($"- Besoins glucides : ~{(int)(carbsPerHour * hoursEst)} g ({carbsPerHour} g/h)");
        }

        // ── Cols et montées détectés ──
        if (req.Cols is { Count: > 0 })
        {
            sb.AppendLine();
            sb.AppendLine("## Montées significatives détectées");
            foreach (var (col, idx) in req.Cols.Select((c, i) => (c, i + 1)))
            {
                var score = col.GainM * col.AvgGradientPct;
                var cat = score switch { > 6000 => "HC", > 2500 => "Cat.1", > 1000 => "Cat.2", > 300 => "Cat.3", _ => "Cat.4" };
                sb.AppendLine($"- Montée {idx} ({cat}) : km {col.StartKm:F1} → {col.EndKm:F1} · {col.LengthKm:F1} km · +{col.GainM:F0} m · {col.AvgGradientPct:F1}% · sommet {col.SummitAlt} m");
            }
            sb.AppendLine("→ Pour chaque montée, précise la stratégie : cadence, position, gestion de l'effort, ravitaillement avant/après.");
        }
        else if (req.KeyPoints is { Count: > 0 })
        {
            sb.AppendLine();
            sb.AppendLine("## Profil altimétrique clé (km → altitude)");
            sb.AppendLine(string.Join(" | ", req.KeyPoints.Take(20).Select(p => $"{p.DistKm:F1}km={p.AltM:F0}m")));
        }

        // ── Étapes de l'itinéraire ──
        if (req.Steps is { Count: > 0 })
        {
            // Merge steps that are too short (< 0.3 km) into the next one to avoid noise
            var merged = new List<StepInfo>();
            float pendingDist = 0;
            string? pendingInstruction = null;
            float pendingCumulative = 0;
            float? pendingAlt = null;
            foreach (var s in req.Steps)
            {
                pendingDist += s.DistanceKm;
                pendingInstruction ??= s.Instruction;
                pendingCumulative = s.CumulativeKm;
                pendingAlt = s.AltM;
                if (pendingDist >= 0.3f)
                {
                    merged.Add(new StepInfo(pendingInstruction, pendingCumulative, pendingDist, pendingAlt));
                    pendingDist = 0; pendingInstruction = null;
                }
            }
            if (pendingInstruction != null)
                merged.Add(new StepInfo(pendingInstruction, pendingCumulative, pendingDist, pendingAlt));

            // Cap at 30 steps for prompt length
            var stepsToShow = merged.Count > 30 ? merged.Where((_, i) => i % (merged.Count / 30 + 1) == 0).ToList() : merged;

            sb.AppendLine();
            sb.AppendLine("## Étapes de l'itinéraire (navigation réelle)");
            sb.AppendLine("Pour chaque étape ci-dessous, tu dois donner : puissance cible (ou % FCmax), zone cardiaque, et éventuellement un conseil tactique ou ravitaillement.");
            sb.AppendLine();
            sb.AppendLine("| km | instruction | alt | objectif |");
            sb.AppendLine("|---|---|---|---|");
            foreach (var step in stepsToShow)
            {
                var altStr = step.AltM.HasValue ? $"{step.AltM:F0}m" : "—";
                sb.AppendLine($"| {step.CumulativeKm:F1} | {step.Instruction} | {altStr} | ← à compléter |");
            }
            sb.AppendLine();
            sb.AppendLine("→ Remplace '← à compléter' par des objectifs concrets pour chaque étape.");
        }

        // ── POIs placés sur la carte ──
        if (req.Pois is { Count: > 0 })
        {
            sb.AppendLine();
            sb.AppendLine("## Points d'intérêt placés sur l'itinéraire");
            foreach (var poi in req.Pois)
            {
                var typeLabel = poi.Type switch
                {
                    "fontaine" => "🚰 Fontaine/eau",
                    "refuge" => "🏠 Refuge",
                    "danger" => "⚠️ Danger",
                    "ravitaillement" => "🍌 Ravitaillement",
                    "vue" => "📸 Point de vue",
                    _ => poi.Type
                };
                var label = string.IsNullOrWhiteSpace(poi.Label) ? "" : $" ({poi.Label})";
                sb.AppendLine($"- {typeLabel}{label}");
            }
            sb.AppendLine("→ Intègre ces POIs dans les conseils de ravitaillement et gestion de l'effort.");
        }

        // ── Objectifs de puissance/FC ──
        sb.AppendLine();
        sb.AppendLine("## Objectifs de puissance et FC selon le niveau");
        if (user.Ftp.HasValue)
        {
            var (powerMin, powerMax, hrZone) = req.Difficulty switch
            {
                "beginner" => ((int)(user.Ftp.Value * 0.45), (int)(user.Ftp.Value * 0.60), "Z1-Z2 (< 75% FCmax)"),
                "medium"   => ((int)(user.Ftp.Value * 0.60), (int)(user.Ftp.Value * 0.75), "Z2-Z3 (75-85% FCmax)"),
                "hard"     => ((int)(user.Ftp.Value * 0.75), (int)(user.Ftp.Value * 0.90), "Z3-Z4 (85-92% FCmax)"),
                "pro"      => ((int)(user.Ftp.Value * 0.88), (int)(user.Ftp.Value * 1.05), "Z4-Z5 (> 90% FCmax)"),
                _          => ((int)(user.Ftp.Value * 0.60), (int)(user.Ftp.Value * 0.75), "Z2-Z3")
            };
            sb.AppendLine($"- Puissance cible globale : {powerMin}-{powerMax} W");
            sb.AppendLine($"- Zone FC cible : {hrZone}");
        }
        else if (user.MaxHrBpm.HasValue)
        {
            var (pctMin, pctMax, zone) = req.Difficulty switch
            {
                "beginner" => (60, 70, "Z1-Z2"),
                "medium"   => (70, 80, "Z2-Z3"),
                "hard"     => (80, 90, "Z3-Z4"),
                "pro"      => (88, 100, "Z4-Z5"),
                _          => (70, 80, "Z2-Z3")
            };
            sb.AppendLine($"- FC cible : {(int)(user.MaxHrBpm.Value * pctMin / 100)}-{(int)(user.MaxHrBpm.Value * pctMax / 100)} bpm ({zone})");
        }

        // ── Instructions de format ──
        sb.AppendLine();
        sb.AppendLine("## Structure de ta réponse (OBLIGATOIRE)");
        sb.AppendLine();
        sb.AppendLine("### 1. Bilan de forme");
        sb.AppendLine("En 2-3 phrases : évalue l'état de fraîcheur du cycliste selon son historique récent et adapte le niveau d'ambition de la sortie.");
        sb.AppendLine();
        if (req.Cols is { Count: > 0 })
        {
            sb.AppendLine("### 2. Stratégie par montée");
            sb.AppendLine("Pour chacune des montées détectées :");
            sb.AppendLine("- Cadence recommandée, position (assis/danseuse), puissance cible ou % FCmax");
            sb.AppendLine("- Moment de ravitaillement (avant la montée, après le sommet)");
            sb.AppendLine("- Piège à éviter (partir trop fort, se laisser décrocher…)");
            sb.AppendLine();
        }
        if (req.Steps is { Count: > 0 })
        {
            sb.AppendLine(req.Cols is { Count: > 0 } ? "### 3. Objectifs par étape de navigation" : "### 2. Objectifs par étape de navigation");
            sb.AppendLine("Reprends le tableau d'étapes fourni et complète la colonne 'objectif' avec :");
            sb.AppendLine("- Puissance en W (ou % FTP) OU % FCmax si pas de capteur puissance");
            sb.AppendLine("- Zone cardiaque (Z1-Z5)");
            sb.AppendLine("- Un mot-clé tactique si pertinent (ex: 'gérer', 'relancer', 'boire', 'gel')");
            sb.AppendLine("Formate en tableau Markdown.");
            sb.AppendLine();
            var nextSectionNum = (req.Cols is { Count: > 0 } ? 4 : 3);
            sb.AppendLine($"### {nextSectionNum}. Plan global par phases");
        }
        else
        {
            sb.AppendLine(req.Cols is { Count: > 0 } ? "### 3. Plan global par phases" : "### 2. Plan global par phases");
        }
        sb.AppendLine("Divise la sortie en 3-5 phases (km X→Y). Pour chaque phase : terrain, puissance/FC cible, ravitaillement, conseil tactique.");
        sb.AppendLine();
        sb.AppendLine("### 4. Préparation (veille + matin du départ)");
        sb.AppendLine("- Repas du soir avec quantités");
        sb.AppendLine("- Petit-déjeuner avec quantités et timing");
        if (weather != null) sb.AppendLine("- Tenue recommandée selon la météo prévue");
        sb.AppendLine();
        sb.AppendLine("### 5. Récupération post-sortie");
        sb.AppendLine("- Fenêtre de récupération nutritionnelle avec quantités");
        sb.AppendLine("- Conseil récupération active si sortie chargée");
        sb.AppendLine();
        sb.AppendLine("Sois PRÉCIS : watts, bpm, grammes, ml, km. Adapte chaque conseil au niveau **" + difficultyLabel + "** et aux données fournies.");

        return sb.ToString();
    }

    private static PlannedRideDetailDto MapDetail(PlannedRide p) =>
        new(p.Id, p.Title, p.PlannedAt, p.DistanceKm, p.ElevationGainM, p.ElevationLossM,
            p.EstimatedDurationMin, p.IsCompleted, p.CreatedAt, p.RoutePolyline, p.AiAdvice, p.GoogleMapsUrl,
            p.RouteStepsJson, p.ElevationJson, p.PoisJson);
}

public record ElevPoint(float DistKm, float AltM);
public record ColInfo(float StartKm, float EndKm, float LengthKm, float GainM, float AvgGradientPct, int SummitAlt);
public record PoiInfo(string Type, string? Label);
public record StepInfo(string Instruction, float CumulativeKm, float DistanceKm, float? AltM = null);
public record RecentRide(DateTime StartedAt, float DistanceKm, float ElevationGainM, int DurationSec);
public record WeatherInfo(float TempMin, float TempMax, float WindKmh, float PrecipPct);

public record PlanRequest(
    float DistanceKm,
    float ElevationGainM,
    float ElevationLossM,
    int EstimatedDurationMin,
    string Difficulty = "medium",
    DateTime? PlannedAt = null,
    List<ElevPoint>? KeyPoints = null,
    List<ColInfo>? Cols = null,
    List<PoiInfo>? Pois = null,
    List<StepInfo>? Steps = null,
    float? StartLat = null,
    float? StartLng = null
);

public record SavePlanRequest(
    string Title,
    float DistanceKm,
    float ElevationGainM,
    float ElevationLossM,
    int EstimatedDurationMin,
    DateTime? PlannedAt = null,
    string? RoutePolyline = null,
    string? GoogleMapsUrl = null,
    string? AiAdvice = null,
    string? RouteStepsJson = null,
    string? ElevationJson = null,
    string? PoisJson = null
);

public record UpdatePlanRequest(string Title, DateTime? PlannedAt, string? RoutePolyline = null, float? DistanceKm = null, float? ElevationGainM = null, float? ElevationLossM = null, int? EstimatedDurationMin = null, string? PoisJson = null, string? AiAdvice = null);
public record PlannedRideDto(Guid Id, string Title, DateTime? PlannedAt, float DistanceKm, float ElevationGainM, float ElevationLossM, int EstimatedDurationMin, bool IsCompleted, DateTime CreatedAt);
public record PlannedRideDetailDto(Guid Id, string Title, DateTime? PlannedAt, float DistanceKm, float ElevationGainM, float ElevationLossM, int EstimatedDurationMin, bool IsCompleted, DateTime CreatedAt, string? RoutePolyline, string? AiAdvice, string? GoogleMapsUrl, string? RouteStepsJson, string? ElevationJson, string? PoisJson);
