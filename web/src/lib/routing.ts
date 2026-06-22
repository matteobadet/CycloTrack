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
  elevProfile: { dist: number; alt: number }[]
  durationEstMin: number
  encodedPolyline: string
  keyPoints: { distKm: number; altM: number }[]
  steps: RouteStep[]
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
  return { distanceKm: distanceM / 1000, elevationGainM: gainM, elevationLossM: lossM, coords, elevProfile, durationEstMin, encodedPolyline, keyPoints, steps }
}
