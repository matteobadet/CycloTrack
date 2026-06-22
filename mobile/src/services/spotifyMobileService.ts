import * as WebBrowser from 'expo-web-browser'
import { api, API_URL } from '../lib/api'

// The redirect URI registered in Spotify dashboard for Expo Go
const EXPO_REDIRECT_URI = 'exp://192.168.1.148:8081'

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
    // Get auth URL from backend, passing our Expo redirect URI
    const res = await api.get(`/spotify/auth-url?redirectUri=${encodeURIComponent(EXPO_REDIRECT_URI)}`)
    const authUrl: string = res.data.url

    // Open browser — it will intercept the redirect to exp:// automatically
    const result = await WebBrowser.openAuthSessionAsync(authUrl, EXPO_REDIRECT_URI)

    if (result.type !== 'success') return false

    // Extract code from the redirect URL
    const url = result.url
    const params = new URLSearchParams(url.split('?')[1] ?? '')
    const code = params.get('code')
    if (!code) return false

    // Send code to backend to exchange for tokens
    await api.post('/spotify/exchange', { code, redirectUri: EXPO_REDIRECT_URI })
    return true
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
