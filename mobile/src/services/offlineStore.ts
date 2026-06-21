import * as SQLite from 'expo-sqlite'
import { TrackPoint, TrackStats } from './trackingService'
import { api } from '../lib/api'

const db = SQLite.openDatabaseSync('cyclotrack.db')

export interface PendingRide {
  localId: string
  startedAt: string
  endedAt: string
  stats: TrackStats
  points: TrackPoint[]
  feelBefore?: number
  commentBefore?: string
  synced: boolean
}

export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS pending_rides (
      local_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
  `)
}

export async function saveRideLocally(ride: Omit<PendingRide, 'synced'>) {
  db.runSync(
    'INSERT OR REPLACE INTO pending_rides (local_id, data, synced) VALUES (?, ?, 0)',
    [ride.localId, JSON.stringify(ride)],
  )
}

export async function syncPendingRides(): Promise<number> {
  const rows = db.getAllSync<{ local_id: string; data: string }>(
    'SELECT local_id, data FROM pending_rides WHERE synced = 0',
  )
  let synced = 0
  for (const row of rows) {
    const ride: PendingRide = JSON.parse(row.data)
    try {
      await api.post('/rides', {
        startedAt: ride.startedAt,
        endedAt: ride.endedAt,
        distanceKm: ride.stats.distanceKm,
        durationSec: ride.stats.durationSec,
        elevationGainM: ride.stats.elevationGainM,
        elevationLossM: ride.stats.elevationLossM,
        avgSpeedKmh: ride.stats.avgSpeedKmh,
        maxSpeedKmh: ride.stats.maxSpeedKmh,
        avgWatts: ride.stats.avgWatts,
        maxWatts: ride.stats.maxWatts,
        avgCadenceRpm: ride.stats.avgCadenceRpm,
        avgBpm: ride.stats.avgBpm,
        maxBpm: ride.stats.maxBpm,
        caloriesBurned: ride.stats.caloriesBurned,
        feelBefore: ride.feelBefore ?? null,
        commentBefore: ride.commentBefore ?? null,
        points: ride.points.map(p => ({
          timestamp: new Date(p.timestamp).toISOString(),
          lat: p.lat,
          lng: p.lng,
          altitudeM: p.altitudeM,
          speedKmh: p.speedKmh,
          watts: p.watts,
          bpm: p.bpm,
          cadenceRpm: p.cadenceRpm,
        })),
      })
      db.runSync('UPDATE pending_rides SET synced = 1 WHERE local_id = ?', [row.local_id])
      synced++
    } catch {
      // Garder la sortie en pending, réessayer plus tard
    }
  }
  return synced
}

export function getPendingCount(): number {
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM pending_rides WHERE synced = 0')
  return row?.count ?? 0
}
