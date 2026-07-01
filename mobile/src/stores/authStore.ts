import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface AuthUser {
  id: string
  email: string
  pseudo: string
  role: string
  heightCm?: number
  weightKg?: number
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (user: AuthUser, token: string) => void
  setToken: (token: string) => void
  logout: () => void
  loadFromStorage: () => Promise<void>
}

const TOKEN_KEY  = 'cyclotrack-token'
const EXPIRY_KEY = 'cyclotrack-token-expiry'
const USER_KEY   = 'cyclotrack-user'
const TOKEN_LIFETIME_MS = 14 * 60 * 1000 // 14 min (access token = 15 min)

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => {
    set({ user, accessToken })
    AsyncStorage.multiSet([
      [USER_KEY,   JSON.stringify(user)],
      [TOKEN_KEY,  accessToken],
      [EXPIRY_KEY, String(Date.now() + TOKEN_LIFETIME_MS)],
    ])
  },
  setToken: (accessToken) => {
    set({ accessToken })
    AsyncStorage.multiSet([
      [TOKEN_KEY,  accessToken],
      [EXPIRY_KEY, String(Date.now() + TOKEN_LIFETIME_MS)],
    ])
  },
  logout: () => {
    set({ user: null, accessToken: null })
    AsyncStorage.multiRemove([USER_KEY, TOKEN_KEY, EXPIRY_KEY])
  },
  loadFromStorage: async () => {
    const results = await AsyncStorage.multiGet([USER_KEY, TOKEN_KEY, EXPIRY_KEY])
    const raw    = results[0][1]
    const token  = results[1][1]
    const expiry = Number(results[2][1] ?? 0)
    if (!raw) return
    const validToken = token && Date.now() < expiry ? token : null
    set({ user: JSON.parse(raw), accessToken: validToken })
  },
}))
