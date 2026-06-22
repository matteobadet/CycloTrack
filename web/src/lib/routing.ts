import { api } from './axios'

export interface RouteStep {
  instruction: string
  emoji: string
  cumulativeM: number
  distanceM: number
}

export interface RouteResult {
  coords: [number, number][]
  distanceM: number
  encodedPolyline: string
  steps: RouteStep[]
}

export interface RouteData {
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  coords: [number, number][]
  elevations: number[]        // per-coord altitude (m), same length as coords
  elevProfile: { dist: number; alt: number }[]
  durationEstMin: number
  encodedPolyline: string
  keyPoints: { distKm: number; altM: number }[]
  steps: RouteStep[]
}

// --- Gradient coloring ---

export interface GradientZone {
  label: string
  emoji: string
  color: string
  min: number
  max: number
}

export const GRADIENT_ZONES: GradientZone[] = [
  { label: 'Descente',       emoji: '⬇️', color: '#22c55e', min: -Infinity, max: -3 },
  { label: 'Plat',           emoji: '➡️', color: '#3b82f6', min: -3,        max: 2  },
  { label: 'Montée douce',   emoji: '📈', color: '#eab308', min: 2,         max: 5  },
  { label: 'Montée modérée', emoji: '⬆️', color: '#f97316', min: 5,         max: 8  },
  { label: 'Montée raide',   emoji: '🔺', color: '#ef4444', min: 8,         max: Infinity },
]

export function gradientColor(pct: number): string {
  return GRADIENT_ZONES.find(z => pct >= z.min && pct < z.max)?.color ?? '#3b82f6'
}

export interface GradientSegment {
  coords: [number, number][]
  color: string
}

export function buildGradientSegments(coords: [number, number][], elevations: number[]): GradientSegment[] {
  if (coords.length < 2 || elevations.length < 2) return [{ coords, color: '#3b82f6' }]

  // Assign a smoothed gradient color to each point using a ~100m lookahead window
  const colors: string[] = []
  for (let i = 0; i < coords.length; i++) {
    let dist = 0, j = i
    while (j + 1 < coords.length && dist < 100) {
      dist += haversineM(coords[j], coords[j + 1])
      j++
    }
    const altDiff = elevations[Math.min(j, elevations.length - 1)] - elevations[i]
    colors.push(gradientColor(dist > 1 ? (altDiff / dist) * 100 : 0))
  }

  // Merge consecutive same-color points into segments (overlap by 1 to avoid gaps)
  const segments: GradientSegment[] = []
  let currentColor = colors[0]
  let segCoords: [number, number][] = [coords[0]]

  for (let i = 1; i < coords.length; i++) {
    if (colors[i] !== currentColor) {
      segments.push({ coords: [...segCoords, coords[i]], color: currentColor })
      segCoords = [coords[i - 1]]
      currentColor = colors[i]
    }
    segCoords.push(coords[i])
  }
  if (segCoords.length >= 1) segments.push({ coords: segCoords, color: currentColor })

  return segments
}

// Reconstruct per-coord elevations by interpolating a sampled elevation profile
export function elevationsFromProfile(
  coords: [number, number][],
  profile: { dist: number; alt: number }[]
): number[] {
  if (!profile.length) return new Array(coords.length).fill(0)

  const cumDist: number[] = [0]
  for (let i = 1; i < coords.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineM(coords[i - 1], coords[i]) / 1000)
  }

  return cumDist.map(distKm => {
    if (distKm <= profile[0].dist) return profile[0].alt
    if (distKm >= profile[profile.length - 1].dist) return profile[profile.length - 1].alt
    for (let i = 0; i < profile.length - 1; i++) {
      if (distKm >= profile[i].dist && distKm <= profile[i + 1].dist) {
        const t = (distKm - profile[i].dist) / (profile[i + 1].dist - profile[i].dist)
        return profile[i].alt + t * (profile[i + 1].alt - profile[i].alt)
      }
    }
    return profile[profile.length - 1].alt
  })
}

export function decodePolyline(encoded: string): [number, number][] {
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

export function encodePolyline(coords: [number, number][]): string {
  let result = ''
  let prevLat = 0, prevLng = 0
  for (const [lat, lng] of coords) {
    const dLat = Math.round(lat * 1e5) - prevLat
    const dLng = Math.round(lng * 1e5) - prevLng
    prevLat += dLat
    prevLng += dLng
    for (const v of [dLat, dLng]) {
      let val = v < 0 ? ~(v << 1) : v << 1
      while (val >= 0x20) { result += String.fromCharCode((0x20 | (val & 0x1f)) + 63); val >>= 5 }
      result += String.fromCharCode(val + 63)
    }
  }
  return result
}

export function haversineM([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// BRouter — purpose-built bicycle router with excellent cycle path support
// Profile "fastbike" prefers cycle paths and bike lanes over roads
export async function fetchRoute(waypoints: [number, number][]): Promise<RouteResult> {
  const lonlats = waypoints.map(([lat, lng]) => `${lng},${lat}`).join('|')
  const url = `https://brouter.de/brouter?lonlats=${lonlats}&profile=fastbike&alternativeidx=0&format=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Calcul d\'itinéraire échoué (BRouter)')
  const data = await res.json()

  const feature = data.features?.[0]
  if (!feature) throw new Error('Aucun itinéraire trouvé')

  const rawCoords: [number, number, number][] = feature.geometry.coordinates
  const coords: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng])
  const distanceM = parseFloat(feature.properties?.['track-length'] ?? '0')

  return { coords, distanceM, encodedPolyline: encodePolyline(coords), steps: [] }
}

export async function fetchElevation(coords: [number, number][]): Promise<number[]> {
  const step = Math.max(1, Math.floor(coords.length / 80))
  const sampled = coords.filter((_, i) => i % step === 0)
  const locStr = sampled.map(([lat, lng]) => `${lat},${lng}`).join('|')
  const res = await api.get(`/plan/elevation?locations=${encodeURIComponent(locStr)}`)
  const data = res.data
  if (data.status !== 'OK') throw new Error('Impossible de récupérer l\'altitude.')
  const elevations: number[] = data.results.map((r: any) => r.elevation ?? 0)
  const full: number[] = []
  for (let i = 0; i < coords.length; i++) full.push(elevations[Math.min(Math.floor(i / step), elevations.length - 1)])
  return full
}

export async function computeRoute(waypoints: [number, number][]): Promise<RouteData> {
  const { coords, distanceM, encodedPolyline, steps } = await fetchRoute(waypoints)
  const elevations = await fetchElevation(coords)

  let gainM = 0, lossM = 0
  for (let i = 1; i < elevations.length; i++) {
    const delta = elevations[i] - elevations[i - 1]
    if (delta > 0.5) gainM += delta
    else if (delta < -0.5) lossM += Math.abs(delta)
  }

  let cumDistKm = 0
  const elevProfile: { dist: number; alt: number }[] = []
  const step = Math.max(1, Math.floor(coords.length / 120))
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) cumDistKm += haversineM(coords[i - 1], coords[i]) / 1000
    if (i % step === 0) elevProfile.push({ dist: parseFloat(cumDistKm.toFixed(2)), alt: Math.round(elevations[i]) })
  }

  const keyStep = Math.max(1, Math.floor(elevProfile.length / 15))
  const keyPoints = elevProfile.filter((_, i) => i % keyStep === 0).map(p => ({ distKm: p.dist, altM: p.alt }))

  const durationEstMin = Math.round((distanceM / 1000) / 18 * 60)
  return { distanceKm: distanceM / 1000, elevationGainM: gainM, elevationLossM: lossM, coords, elevations, elevProfile, durationEstMin, encodedPolyline, keyPoints, steps }
}
