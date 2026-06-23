import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Bike, LayoutDashboard, Target, Users, User, LogOut, Sun, Moon, Map, ClipboardList, Menu, X, Bell } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rides', label: 'Sorties', icon: Bike },
  { to: '/plan', label: 'Planifier', icon: Map },
  { to: '/plans', label: 'Planifications', icon: ClipboardList },
  { to: '/goals', label: 'Objectifs', icon: Target },
  { to: '/social', label: 'Social', icon: Users },
  { to: '/profile', label: 'Profil', icon: User },
]

export default function Layout() {
  const logout = useAuthStore(s => s.logout)
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggle } = useThemeStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { unreadCount, fetchNotifications, notifications, markAllRead } = useNotificationStore()
  const [notifOpen, setNotifOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Close notif dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return
    const handler = () => setNotifOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [notifOpen])

  useEffect(() => { fetchNotifications() }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <>
      <div className="p-5 border-b dark:border-slate-700 flex items-center gap-2">
        <Bike className="text-blue-600" size={24} />
        <span className="font-bold text-lg dark:text-white">CycloTrack</span>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t dark:border-slate-700 space-y-1">
        <div className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">{user?.pseudo}</div>
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {dark ? 'Mode clair' : 'Mode sombre'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 w-full"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900">

      {/* Sidebar desktop (toujours visible ≥ md) */}
      <aside className="hidden md:flex w-60 bg-white dark:bg-slate-800 border-r dark:border-slate-700 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar drawer mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-800 border-r dark:border-slate-700 flex flex-col transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-gray-500 dark:text-slate-400 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        <SidebarContent />
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b dark:border-slate-700 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 dark:text-slate-300">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Bike className="text-blue-600" size={20} />
            <span className="font-bold text-base dark:text-white">CycloTrack</span>
          </div>
          {/* Notifications bell (mobile) */}
          <button
            onClick={e => { e.stopPropagation(); setNotifOpen(v => !v) }}
            className="relative text-gray-600 dark:text-slate-300"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        {/* Top bar desktop — notifications uniquement */}
        <header className="hidden md:flex items-center justify-end px-6 py-3 bg-white dark:bg-slate-800 border-b dark:border-slate-700 shrink-0">
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setNotifOpen(v => !v) }}
              className="relative text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown notifications */}
            {notifOpen && (
              <div
                onClick={e => e.stopPropagation()}
                className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
                  <span className="font-semibold text-sm dark:text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y dark:divide-slate-700">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
                      Aucune notification
                    </p>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 text-sm ${n.isRead ? 'text-gray-500 dark:text-slate-400' : 'text-gray-900 dark:text-white font-medium bg-blue-50/50 dark:bg-blue-900/10'}`}
                      >
                        <p>{n.message}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                          {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto dark:text-slate-100">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
