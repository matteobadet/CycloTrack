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

        var client = httpClientFactory.CreateClient("Groq");
        var prompt = BuildPrompt(req, user);

        var groqReq = new
        {
            model = "llama-3.3-70b-versatile",
            max_tokens = 1800,
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
        };
        db.PlannedRides.Add(plan);
        await db.SaveChangesAsync();
        return Ok(new { id = plan.Id });
    }

    private static string BuildPrompt(PlanRequest req, User user)
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

        sb.AppendLine("## Profil du cycliste");
        if (user.WeightKg.HasValue) sb.AppendLine($"- Poids : {user.WeightKg} kg");
        if (user.HeightCm.HasValue) sb.AppendLine($"- Taille : {user.HeightCm} cm");
        if (user.Ftp.HasValue) sb.AppendLine($"- FTP : {user.Ftp} W (référence de puissance)");
        if (user.MaxHrBpm.HasValue) sb.AppendLine($"- FC max : {user.MaxHrBpm} bpm");
        var goalLabel = user.Goal switch { "weight_loss" => "Perte de poids", "performance" => "Performance", "endurance" => "Endurance", _ => null };
        if (goalLabel != null) sb.AppendLine($"- Objectif général : {goalLabel}");
        sb.AppendLine($"- Niveau pour cette sortie : **{difficultyLabel}**");

        sb.AppendLine();
        sb.AppendLine("## Itinéraire");
        sb.AppendLine($"- Distance totale : {req.DistanceKm:F1} km");
        sb.AppendLine($"- Dénivelé positif : {req.ElevationGainM:F0} m");
        sb.AppendLine($"- Dénivelé négatif : {req.ElevationLossM:F0} m");
        sb.AppendLine($"- Durée estimée : {req.EstimatedDurationMin / 60}h{req.EstimatedDurationMin % 60:D2}");

        if (req.PlannedAt.HasValue)
        {
            var local = req.PlannedAt.Value.ToLocalTime();
            sb.AppendLine($"- Date/heure de départ : {local:dddd d MMMM yyyy} à {local:HH:mm}");
            var isWeekend = local.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            sb.AppendLine($"- Contexte : {(isWeekend ? "week-end" : "semaine")}");
        }

        // Elevation analysis
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

        // Key elevation points
        if (req.KeyPoints is { Count: > 0 })
        {
            sb.AppendLine();
            sb.AppendLine("## Profil altimétrique clé (distance km → altitude m)");
            var points = req.KeyPoints.Take(20).Select(p => $"{p.DistKm:F1}km={p.AltM:F0}m").ToList();
            sb.AppendLine(string.Join(" | ", points));
        }

        // Difficulty targets
        sb.AppendLine();
        sb.AppendLine("## Objectifs selon le niveau");
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
            sb.AppendLine($"- Puissance cible : {powerMin}-{powerMax} W");
            sb.AppendLine($"- Zone FC : {hrZone}");
        }

        sb.AppendLine();
        sb.AppendLine("## Structure de ta réponse (OBLIGATOIRE — respecte exactement)");
        sb.AppendLine();
        sb.AppendLine("### 1. Plan de sortie par étapes");
        sb.AppendLine("Divise la sortie en 3-5 étapes basées sur le profil altimétrique. Pour chaque étape :");
        sb.AppendLine("- Distance (ex: km 0→15)");
        sb.AppendLine("- Terrain (montée / descente / plat)");
        sb.AppendLine("- Objectif puissance ET FC pour ce niveau");
        sb.AppendLine("- Conseil tactique (ex: rester assis en montée, relancer après le col…)");
        sb.AppendLine("- Ravitaillement prévu à cette étape (gel, barre, eau…)");
        sb.AppendLine();
        sb.AppendLine("### 2. Préparation (veille + matin)");
        sb.AppendLine("- Repas du soir avec quantités");
        sb.AppendLine("- Petit-déjeuner avec quantités et timing avant le départ");
        sb.AppendLine();
        sb.AppendLine("### 3. Récupération post-sortie");
        sb.AppendLine("- Fenêtre de récupération nutritionnelle avec quantités");
        sb.AppendLine();
        sb.AppendLine("Sois PRÉCIS : watts, bpm, grammes, ml, km. Adapte chaque conseil au niveau demandé.");

        return sb.ToString();
    }

    private static PlannedRideDetailDto MapDetail(PlannedRide p) =>
        new(p.Id, p.Title, p.PlannedAt, p.DistanceKm, p.ElevationGainM, p.ElevationLossM,
            p.EstimatedDurationMin, p.IsCompleted, p.CreatedAt, p.RoutePolyline, p.AiAdvice, p.GoogleMapsUrl,
            p.RouteStepsJson, p.ElevationJson);
}

public record ElevPoint(float DistKm, float AltM);

public record PlanRequest(
    float DistanceKm,
    float ElevationGainM,
    float ElevationLossM,
    int EstimatedDurationMin,
    string Difficulty = "medium",
    DateTime? PlannedAt = null,
    List<ElevPoint>? KeyPoints = null
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
    string? ElevationJson = null
);

public record UpdatePlanRequest(string Title, DateTime? PlannedAt, string? RoutePolyline = null, float? DistanceKm = null, float? ElevationGainM = null, float? ElevationLossM = null, int? EstimatedDurationMin = null);
public record PlannedRideDto(Guid Id, string Title, DateTime? PlannedAt, float DistanceKm, float ElevationGainM, float ElevationLossM, int EstimatedDurationMin, bool IsCompleted, DateTime CreatedAt);
public record PlannedRideDetailDto(Guid Id, string Title, DateTime? PlannedAt, float DistanceKm, float ElevationGainM, float ElevationLossM, int EstimatedDurationMin, bool IsCompleted, DateTime CreatedAt, string? RoutePolyline, string? AiAdvice, string? GoogleMapsUrl, string? RouteStepsJson, string? ElevationJson);
