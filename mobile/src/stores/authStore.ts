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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => {
    set({ user, accessToken })
    AsyncStorage.setItem('cyclotrack-user', JSON.stringify(user))
  },
  setToken: (accessToken) => set({ accessToken }),
  logout: () => {
    set({ user: null, accessToken: null })
    AsyncStorage.removeItem('cyclotrack-user')
  },
  loadFromStorage: async () => {
    const raw = await AsyncStorage.getItem('cyclotrack-user')
    if (raw) set({ user: JSON.parse(raw) })
  },
}))
