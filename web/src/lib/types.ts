export interface Ride {
  id: string
  userId: string
  userPseudo: string
  startedAt: string
  endedAt?: string
  distanceKm: number
  durationSec: number
  elevationGainM: number
  elevationLossM: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  avgWatts?: number
  maxWatts?: number
  avgCadenceRpm?: number
  avgBpm?: number
  maxBpm?: number
  caloriesBurned: number
  feelBefore?: number
  commentBefore?: string
  aiAnalysis?: string
}

export interface RidePoint {
  timestamp: string
  lat: number
  lng: number
  altitudeM?: number
  speedKmh?: number
  watts?: number
  bpm?: number
  cadenceRpm?: number
}

export interface Goal {
  id: string
  type: 'Distance' | 'Elevation' | 'RideCount' | 'Performance'
  period: 'Week' | 'Month' | 'Year'
  targetValue: number
  description?: string
  startDate: string
  endDate: string
  isAchieved: boolean
  currentValue: number
}

export interface Stats {
  totalRides: number
  totalDistanceKm: number
  totalElevationM: number
  totalCalories: number
  recentRides: Pick<Ride, 'id' | 'startedAt' | 'distanceKm' | 'durationSec' | 'avgSpeedKmh'>[]
}
