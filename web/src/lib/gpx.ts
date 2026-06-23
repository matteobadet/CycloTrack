import { encodePolyline, haversineM } from './routing'

export interface GpxRouteData {
  coords: [number, number][]
  elevations: number[]
  elevProfile: { dist: number; alt: number }[]
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  encodedPolyline: string
  durationEstMin: number
  keyPoints: { distKm: number; altM: number }[]
}

export function parseGpx(text: string): GpxRouteData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')

  const trkpts = [...doc.querySelectorAll('trkpt')]
  if (trkpts.length < 2) throw new Error('Le fichier GPX ne contient pas de tracé (trkpt).')

  const coords: [number, number][] = trkpts.map(pt => [
    parseFloat(pt.getAttribute('lat')!),
    parseFloat(pt.getAttribute('lon')!),
  ])
  const elevations: number[] = trkpts.map(pt => {
    const ele = pt.querySelector('ele')
    return ele ? parseFloat(ele.textContent!) : 0
  })

  // Compute distance, gain, loss
  let distanceKm = 0
  let elevationGainM = 0
  let elevationLossM = 0
  const cumDist: number[] = [0]

  for (let i = 1; i < coords.length; i++) {
    const d = haversineM(coords[i - 1], coords[i]) / 1000
    distanceKm += d
    cumDist.push(distanceKm)
    const delta = elevations[i] - elevations[i - 1]
    if (delta > 0.5) elevationGainM += delta
    else if (delta < -0.5) elevationLossM += Math.abs(delta)
  }

  // Elevation profile (sampled)
  const step = Math.max(1, Math.floor(coords.length / 120))
  const elevProfile: { dist: number; alt: number }[] = []
  for (let i = 0; i < coords.length; i++) {
    if (i % step === 0) elevProfile.push({ dist: parseFloat(cumDist[i].toFixed(2)), alt: Math.round(elevations[i]) })
  }

  const keyStep = Math.max(1, Math.floor(elevProfile.length / 15))
  const keyPoints = elevProfile.filter((_, i) => i % keyStep === 0).map(p => ({ distKm: p.dist, altM: p.alt }))

  const durationEstMin = Math.round(distanceKm / 18 * 60)
  const encodedPolyline = encodePolyline(coords)

  return { coords, elevations, elevProfile, distanceKm, elevationGainM, elevationLossM, encodedPolyline, durationEstMin, keyPoints }
}
