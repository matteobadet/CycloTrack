import { create } from 'zustand'
import { api } from '@/lib/axios'

export interface Notification {
  id: string
  message: string
  type: 'reaction' | 'comment' | 'follow' | 'goal_achieved'
  isRead: boolean
  createdAt: string
  rideId?: string
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  async fetchNotifications() {
    try {
      const res = await api.get('/notifications')
      const notifs: Notification[] = res.data
      set({
        notifications: notifs,
        unreadCount: notifs.filter(n => !n.isRead).length,
      })
    } catch {
      // silently fail — non-blocking
    }
  },

  async markAllRead() {
    try {
      await api.put('/notifications/read-all')
      set(s => ({
        notifications: s.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }))
    } catch {
      // ignore
    }
  },
}))
