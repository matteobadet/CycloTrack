import { useColorScheme } from 'react-native'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const light = {
  bg: '#f9fafb',
  card: '#ffffff',
  text: '#111827',
  textSub: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  inputBg: '#f3f4f6',
  green: '#16a34a',
  blue: '#2563eb',
  purple: '#7c3aed',
  orange: '#f97316',
  amber: '#d97706',
  red: '#dc2626',
}

export const dark = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#f1f5f9',
  textSub: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  inputBg: '#1e293b',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  orange: '#fb923c',
  amber: '#fbbf24',
  red: '#f87171',
}

export type Theme = typeof light

interface ThemeStore {
  override: 'light' | 'dark' | null
  setOverride: (v: 'light' | 'dark' | null) => void
  loadOverride: () => Promise<void>
}

export const useThemeStore = create<ThemeStore>((set) => ({
  override: null,
  setOverride: async (v) => {
    set({ override: v })
    if (v) await AsyncStorage.setItem('themeOverride', v)
    else await AsyncStorage.removeItem('themeOverride')
  },
  loadOverride: async () => {
    const stored = await AsyncStorage.getItem('themeOverride')
    if (stored === 'light' || stored === 'dark') set({ override: stored })
  },
}))

export function useTheme(): Theme {
  const scheme = useColorScheme()
  const override = useThemeStore(s => s.override)
  const resolved = override ?? scheme ?? 'light'
  return resolved === 'dark' ? dark : light
}

export function useIsDark(): boolean {
  const scheme = useColorScheme()
  const override = useThemeStore(s => s.override)
  const resolved = override ?? scheme ?? 'light'
  return resolved === 'dark'
}
