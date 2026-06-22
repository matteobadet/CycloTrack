import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

// En dev, pointer vers l'API en local. En prod Docker, remplacer par l'IP du serveur.
// Sur vrai device : IP de la machine hôte sur le réseau local (même que Metro)
// Sur émulateur Android : http://10.0.2.2:5002
export const API_URL = 'http://167.233.129.150:5002'

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true
      try {
        const { data } = await api.post('/auth/refresh')
        useAuthStore.getState().setToken(data.accessToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
      }
    }
    return Promise.reject(error)
  },
)
