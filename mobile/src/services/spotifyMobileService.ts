import * as WebBrowser from 'expo-web-browser'
import { api, API_URL } from '../lib/api'

export interface SpotifyTrackInfo {
  trackName: string
  artistName: string
  albumArtUrl?: string
  tempo?: number
}

let pollInterval: ReturnType<typeof setInterval> | null = null
let currentRideId: string | null = null

export async function openSpotifyAuth(): Promise<boolean> {
  try {
    // Use server-side callback — works everywhere (no exp:// URI needed)
    const res = await api.get('/spotify/auth-url')
    const authUrl: string = res.data.url

    // Open browser — server handles the OAuth callback and shows a success page
    await WebBrowser.openBrowserAsync(authUrl)

    // Browser closed — check if Spotify was linked
    return await getSpotifyStatus()
  } catch {
    return false
  }
}

export async function getSpotifyStatus(): Promise<boolean> {
  try {
    const res = await api.get('/spotify/status')
    return res.data.linked === true
  } catch {
    return false
  }
}

export async function unlinkSpotify(): Promise<void> {
  await api.delete('/spotify/unlink')
}

export function startSpotifyPolling(
  rideId: string,
  getMetrics: () => { currentSpeedKmh?: number; currentWatts?: number; currentBpm?: number; elevDeltaM?: number },
  onTrack: (track: SpotifyTrackInfo | null) => void
) {
  currentRideId = rideId
  stopSpotifyPolling()

  const poll = async () => {
    if (!currentRideId) return
    try {
      const metrics = getMetrics()
      const res = await api.post(`/rides/${currentRideId}/tracks/poll`, {
        currentSpeedKmh: metrics.currentSpeedKmh ?? null,
        currentWatts: metrics.currentWatts ?? null,
        currentBpm: metrics.currentBpm ?? null,
        elevDeltaM: metrics.elevDeltaM ?? null,
      })
      if (res.data.playing) {
        onTrack({
          trackName: res.data.trackName,
          artistName: res.data.artistName,
          albumArtUrl: res.data.albumArtUrl,
          tempo: res.data.tempo,
        })
      } else {
        onTrack(null)
      }
    } catch {
      // silent fail — Spotify polling is non-critical
    }
  }

  poll()
  pollInterval = setInterval(poll, 30_000)
}

export function stopSpotifyPolling() {
  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  currentRideId = null
}
