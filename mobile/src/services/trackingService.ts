import * as Location from 'expo-location'

export interface TrackPoint {
  timestamp: number
  lat: number
  lng: number
  altitudeM: number | null
  speedKmh: number | null
  watts: number | null
  bpm: number | null
  cadenceRpm: number | null
}

export interface TrackStats {
  distanceKm: number
  durationSec: number
  elevationGainM: number
  elevationLossM: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  avgWatts: number | null
  maxWatts: number | null
  avgBpm: number | null
  maxBpm: number | null
  avgCadenceRpm: number | null
  caloriesBurned: number
}

type StatsCallback = (stats: TrackStats, points: TrackPoint[]) => void

const GPS_NORMAL: Location.LocationOptions = { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 }
const GPS_SAVER: Location.LocationOptions = { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 }

class TrackingService {
  private points: TrackPoint[] = []
  private subscription: Location.LocationSubscription | null = null
  private startTime: number = 0
  private pausedDuration: number = 0
  private pauseStart: number | null = null
  private currentBle: { watts: number | null; bpm: number | null; cadenceRpm: number | null } =
    { watts: null, bpm: null, cadenceRpm: null }
  private statsCallback: StatsCallback | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private gpsOptions: Location.LocationOptions = GPS_NORMAL
  private isTracking = false

  async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync()
    return status === 'granted'
  }

  async setBatterySaver(enabled: boolean) {
    this.gpsOptions = enabled ? GPS_SAVER : GPS_NORMAL
    if (this.isTracking && this.subscription) {
      this.subscription.remove()
      this.subscription = await Location.watchPositionAsync(this.gpsOptions, loc => this.onLocation(loc))
    }
  }

  private onLocation(location: Location.LocationObject) {
    const point: TrackPoint = {
      timestamp: location.timestamp,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      altitudeM: location.coords.altitude,
      speedKmh: location.coords.speed !== null ? location.coords.speed * 3.6 : null,
      ...this.currentBle,
    }
    this.points.push(point)
    this.emitStats()
  }

  async start(onStats: StatsCallback) {
    this.points = []
    this.startTime = Date.now()
    this.pausedDuration = 0
    this.pauseStart = null
    this.statsCallback = onStats
    this.isTracking = true

    this.subscription = await Location.watchPositionAsync(this.gpsOptions, loc => this.onLocation(loc))
    // Emit stats every second for the timer
    this.intervalId = setInterval(() => this.emitStats(), 1000)
  }

  updateBle(readings: { watts?: number | null; bpm?: number | null; cadenceRpm?: number | null }) {
    this.currentBle = { ...this.currentBle, ...readings }
  }

  pause() {
    this.pauseStart = Date.now()
    this.subscription?.remove()
    this.subscription = null
  }

  async resume() {
    if (this.pauseStart) {
      this.pausedDuration += Date.now() - this.pauseStart
      this.pauseStart = null
    }
    if (this.statsCallback) {
      this.subscription = await Location.watchPositionAsync(this.gpsOptions, loc => this.onLocation(loc))
    }
  }

  stop(): { stats: TrackStats; points: TrackPoint[] } {
    this.subscription?.remove()
    this.subscription = null
    this.isTracking = false
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
    const stats = this.computeStats()
    return { stats, points: this.points }
  }

  private emitStats() {
    if (this.statsCallback) this.statsCallback(this.computeStats(), this.points)
  }

  private computeStats(): TrackStats {
    const elapsed = this.pauseStart
      ? this.pauseStart - this.startTime - this.pausedDuration
      : Date.now() - this.startTime - this.pausedDuration
    const durationSec = Math.floor(elapsed / 1000)

    let distanceKm = 0
    let elevationGainM = 0
    let elevationLossM = 0
    let maxSpeedKmh = 0
    const speeds: number[] = []
    const wattsList: number[] = []
    const bpmList: number[] = []
    const cadenceList: number[] = []

    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1]
      const curr = this.points[i]
      distanceKm += haversineKm(prev.lat, prev.lng, curr.lat, curr.lng)

      if (prev.altitudeM !== null && curr.altitudeM !== null) {
        const diff = curr.altitudeM - prev.altitudeM
        if (diff > 0) elevationGainM += diff
        else elevationLossM += Math.abs(diff)
      }

      if (curr.speedKmh !== null) {
        speeds.push(curr.speedKmh)
        if (curr.speedKmh > maxSpeedKmh) maxSpeedKmh = curr.speedKmh
      }
      if (curr.watts !== null) wattsList.push(curr.watts)
      if (curr.bpm !== null) bpmList.push(curr.bpm)
      if (curr.cadenceRpm !== null) cadenceList.push(curr.cadenceRpm)
    }

    const avgSpeedKmh = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
    const avgWatts = wattsList.length ? wattsList.reduce((a, b) => a + b, 0) / wattsList.length : null
    const maxWatts = wattsList.length ? Math.max(...wattsList) : null
    const avgBpm = bpmList.length ? Math.round(bpmList.reduce((a, b) => a + b, 0) / bpmList.length) : null
    const maxBpm = bpmList.length ? Math.max(...bpmList) : null
    const avgCadenceRpm = cadenceList.length ? cadenceList.reduce((a, b) => a + b, 0) / cadenceList.length : null

    // Calories : formule approximative basée sur watts ou vitesse + poids (70kg par défaut)
    const weightKg = 70
    const caloriesBurned = avgWatts
      ? (avgWatts * durationSec * 0.00024)
      : (distanceKm * weightKg * 0.04)

    return {
      distanceKm, durationSec, elevationGainM, elevationLossM,
      avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
      maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
      avgWatts: avgWatts ? Math.round(avgWatts) : null,
      maxWatts,
      avgBpm,
      maxBpm,
      avgCadenceRpm: avgCadenceRpm ? Math.round(avgCadenceRpm) : null,
      caloriesBurned: Math.round(caloriesBurned),
    }
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) { return deg * Math.PI / 180 }

export const trackingService = new TrackingService()
