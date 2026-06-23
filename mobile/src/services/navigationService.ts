// Navigation service: computes turn-by-turn instructions + elevation + nutrition cues
// from a loaded planned ride.

export interface RouteStep {
  instruction: string
  emoji: string
  cumulativeM: number
  distanceM: number
}

export interface ElevPoint {
  dist: number // km
  alt: number  // m
}

export interface NavCue {
  type: 'turn' | 'elevation' | 'nutrition' | 'arrival'
  emoji: string
  message: string
  distanceAheadM?: number // for turn/elevation: "dans Xm"
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

export class NavigationService {
  readonly routeCoords: [number, number][]
  readonly routeSteps: RouteStep[]
  readonly elevProfile: ElevPoint[]
  // Cumulative distances at each route point (m)
  private readonly cumDist: number[]
  readonly totalDistM: number

  constructor(polyline: string, stepsJson: string, elevJson: string) {
    this.routeCoords = decodePolyline(polyline)
    const allSteps = JSON.parse(stepsJson) as RouteStep[]
    // Remove intermediate arrival steps (OSRM adds "Arrivée" at each waypoint)
    this.routeSteps = allSteps.filter((s, i, arr) => {
      const isArrival = s.instruction.toLowerCase().includes('arrivée') || s.emoji === '🏁'
      return !isArrival || i === arr.length - 1
    })
    this.elevProfile = JSON.parse(elevJson) as ElevPoint[]

    // Pre-compute cumulative distances
    this.cumDist = [0]
    for (let i = 1; i < this.routeCoords.length; i++) {
      const [lat1, lng1] = this.routeCoords[i - 1]
      const [lat2, lng2] = this.routeCoords[i]
      this.cumDist.push(this.cumDist[i - 1] + haversineM(lat1, lng1, lat2, lng2))
    }
    this.totalDistM = this.cumDist[this.cumDist.length - 1] || 0
  }

  // Returns the distance (m) from the given position to the nearest point on the route
  minDistToRouteM(lat: number, lng: number): number {
    let best = Infinity
    for (const [rlat, rlng] of this.routeCoords) {
      const d = haversineM(lat, lng, rlat, rlng)
      if (d < best) best = d
      if (d > 500 && best < 50) break
    }
    return best
  }

  // Find index of closest route point to current position
  private nearestRouteIdx(lat: number, lng: number): number {
    let best = 0, bestDist = Infinity
    // Only search nearby points for performance
    for (let i = 0; i < this.routeCoords.length; i++) {
      const d = haversineM(lat, lng, this.routeCoords[i][0], this.routeCoords[i][1])
      if (d < bestDist) { bestDist = d; best = i }
      if (d > 500 && bestDist < 50) break // stop if we've found a close match and moved away
    }
    return best
  }

  // Returns distance travelled along the route (m) from current GPS position
  distanceAlongRoute(lat: number, lng: number): number {
    const idx = this.nearestRouteIdx(lat, lng)
    return this.cumDist[idx]
  }

  // Main function: given current position + elapsed seconds, return active nav cues
  getCues(lat: number, lng: number, elapsedSec: number): NavCue[] {
    const cues: NavCue[] = []
    const progressM = this.distanceAlongRoute(lat, lng)

    // --- Turn-by-turn instruction ---
    // Find the next step ahead (cumulativeM > progressM)
    const nextStep = this.routeSteps.find(s => s.cumulativeM > progressM)
    if (nextStep) {
      const distToStep = nextStep.cumulativeM - progressM
      if (distToStep < 300) {
        const distText = distToStep < 50 ? 'maintenant' : `dans ${Math.round(distToStep / 10) * 10}m`
        cues.push({ type: 'turn', emoji: nextStep.emoji, message: `${nextStep.instruction} — ${distText}`, distanceAheadM: distToStep })
      }
    }

    // --- Arrival (only when >50% done to avoid false positive at start) ---
    const distToEnd = this.totalDistM - progressM
    if (distToEnd < 200 && distToEnd > 0 && progressM > this.totalDistM * 0.5) {
      cues.push({ type: 'arrival', emoji: '🏁', message: `Arrivée dans ${Math.round(distToEnd)}m !` })
    }

    // --- Elevation cues (look 400m ahead) ---
    const lookaheadM = progressM + 400
    const currentKm = progressM / 1000
    const lookaheadKm = lookaheadM / 1000

    const currentElev = this.elevAtKm(currentKm)
    const lookaheadElev = this.elevAtKm(lookaheadKm)

    if (currentElev !== null && lookaheadElev !== null) {
      const delta = lookaheadElev - currentElev
      if (delta > 15) {
        cues.push({ type: 'elevation', emoji: '📈', message: `Montée dans ~400m (+${Math.round(delta)}m)`, distanceAheadM: 400 })
      } else if (delta < -20) {
        cues.push({ type: 'elevation', emoji: '📉', message: `Descente dans ~400m (${Math.round(delta)}m)`, distanceAheadM: 400 })
      }
    }

    // --- Nutrition / hydration cues (time-based) ---
    const elapsedMin = elapsedSec / 60
    const nutritionCue = this.getNutritionCue(elapsedMin)
    if (nutritionCue) cues.push(nutritionCue)

    return cues
  }

  private elevAtKm(km: number): number | null {
    if (!this.elevProfile.length) return null
    // Find surrounding points and interpolate
    for (let i = 0; i < this.elevProfile.length - 1; i++) {
      const a = this.elevProfile[i], b = this.elevProfile[i + 1]
      if (km >= a.dist && km <= b.dist) {
        const t = (km - a.dist) / (b.dist - a.dist)
        return a.alt + t * (b.alt - a.alt)
      }
    }
    if (km <= this.elevProfile[0].dist) return this.elevProfile[0].alt
    return this.elevProfile[this.elevProfile.length - 1].alt
  }

  // Time-based nutrition cues — fires once per window
  private getNutritionCue(elapsedMin: number): NavCue | null {
    // Every 20 min: hydration reminder
    // Every 45 min: food reminder
    const hydrationWindow = Math.floor(elapsedMin / 20)
    const foodWindow = Math.floor(elapsedMin / 45)
    const minInWindow = elapsedMin % 20
    const minInFoodWindow = elapsedMin % 45

    // Trigger in the first 2 minutes of each window
    if (minInWindow >= 0 && minInWindow < 2 && hydrationWindow > 0) {
      return { type: 'nutrition', emoji: '💧', message: `Bois 150-200ml d'eau maintenant` }
    }
    if (minInFoodWindow >= 0 && minInFoodWindow < 2 && foodWindow > 0) {
      // Alternate between gel and bar
      const msg = foodWindow % 2 === 1 ? 'Prends une barre énergétique' : 'Prends un gel ou des fruits secs'
      return { type: 'nutrition', emoji: '🍌', message: msg }
    }

    return null
  }
}
