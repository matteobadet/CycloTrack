import * as AuthSession from 'expo-auth-session'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ── Config ────────────────────────────────────────────────────────────────────
const CLIENT_ID   = 'b0fb6ec199f44795bb5320c6a482f7af'
const SCOPES      = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
]
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'cyclotrack', path: 'spotify' })

const STORAGE_KEY_ACCESS  = 'spotify_access_token'
const STORAGE_KEY_REFRESH = 'spotify_refresh_token'
const STORAGE_KEY_EXPIRY  = 'spotify_token_expiry'

export interface SpotifyTrackInfo {
  trackName: string
  artistName: string
  albumArtUrl?: string
  isPlaying: boolean
}

// ── Token storage ─────────────────────────────────────────────────────────────
async function saveTokens(access: string, refresh: string, expiresIn: number) {
  const expiry = Date.now() + expiresIn * 1000
  await AsyncStorage.multiSet([
    [STORAGE_KEY_ACCESS,  access],
    [STORAGE_KEY_REFRESH, refresh],
    [STORAGE_KEY_EXPIRY,  String(expiry)],
  ])
}

async function getValidAccessToken(): Promise<string | null> {
  const [[, access], [, refresh], [, expiryStr]] = await AsyncStorage.multiGet([
    STORAGE_KEY_ACCESS, STORAGE_KEY_REFRESH, STORAGE_KEY_EXPIRY,
  ])
  if (!access) return null
  const expiry = Number(expiryStr ?? 0)
  if (Date.now() < expiry - 60_000) return access
  if (!refresh) return null
  return refreshAccessToken(refresh)
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     CLIENT_ID,
      }).toString(),
    })
    if (!res.ok) { await clearTokens(); return null }
    const data = await res.json()
    await saveTokens(data.access_token, data.refresh_token ?? refreshToken, data.expires_in)
    return data.access_token
  } catch {
    return null
  }
}

async function clearTokens() {
  await AsyncStorage.multiRemove([STORAGE_KEY_ACCESS, STORAGE_KEY_REFRESH, STORAGE_KEY_EXPIRY])
}

// ── PKCE OAuth ────────────────────────────────────────────────────────────────
export async function openSpotifyAuth(): Promise<boolean> {
  const discovery = { authorizationEndpoint: 'https://accounts.spotify.com/authorize' }

  const request = new AuthSession.AuthRequest({
    clientId:     CLIENT_ID,
    scopes:       SCOPES,
    redirectUri:  REDIRECT_URI,
    usePKCE:      true,
    responseType: AuthSession.ResponseType.Code,
  })

  let result: AuthSession.AuthSessionResult
  try {
    result = await request.promptAsync(discovery)
  } catch {
    return false
  }

  if (result.type !== 'success' || !result.params.code) return false

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code:          result.params.code,
        redirect_uri:  REDIRECT_URI,
        client_id:     CLIENT_ID,
        code_verifier: request.codeVerifier!,
      }).toString(),
    })
    if (!res.ok) return false
    const data = await res.json()
    await saveTokens(data.access_token, data.refresh_token, data.expires_in)
    return true
  } catch {
    return false
  }
}

export async function getSpotifyStatus(): Promise<boolean> {
  const token = await getValidAccessToken()
  return token !== null
}

export async function unlinkSpotify(): Promise<void> {
  await clearTokens()
}

// ── Playback controls ─────────────────────────────────────────────────────────
// Returns 'ok' | 'no_token' | 'scope_error' | 'error'
async function playerAction(method: 'PUT' | 'POST', endpoint: string): Promise<string> {
  const token = await getValidAccessToken()
  if (!token) return 'no_token'
  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 403) return 'scope_error'
    if (res.status === 404) return 'no_device' // no active player
    if (!res.ok) return 'error'
    return 'ok'
  } catch {
    return 'error'
  }
}

export const spotifyPlay     = () => playerAction('PUT',  'play')
export const spotifyPause    = () => playerAction('PUT',  'pause')
export const spotifyNext     = () => playerAction('POST', 'next')
export const spotifyPrevious = () => playerAction('POST', 'previous')

// ── Polling ───────────────────────────────────────────────────────────────────
let pollInterval: ReturnType<typeof setInterval> | null = null

export function startSpotifyPolling(
  _rideId: string,
  _getMetrics: () => { currentSpeedKmh?: number; currentWatts?: number; currentBpm?: number; elevDeltaM?: number },
  onTrack: (track: SpotifyTrackInfo | null) => void
) {
  stopSpotifyPolling()

  const poll = async () => {
    const token = await getValidAccessToken()
    if (!token) { onTrack(null); return }

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 204 || res.status === 404) { onTrack(null); return }
      if (!res.ok) { onTrack(null); return }

      const data = await res.json()
      if (!data?.item) { onTrack(null); return }

      const item = data.item
      onTrack({
        trackName:   item.name,
        artistName:  item.artists?.map((a: any) => a.name).join(', ') ?? '',
        albumArtUrl: item.album?.images?.[0]?.url,
        isPlaying:   data.is_playing ?? false,
      })
    } catch {
      onTrack(null)
    }
  }

  poll()
  pollInterval = setInterval(poll, 10_000)
}

export function stopSpotifyPolling() {
  if (pollInterval !== null) { clearInterval(pollInterval); pollInterval = null }
}
