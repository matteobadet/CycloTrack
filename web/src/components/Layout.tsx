import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { Bike, LayoutDashboard, Target, Users, User, LogOut, Sun, Moon, Map, ClipboardList } from 'lucide-react'

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
  const { dark, toggle } = useThemeStore()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900">
      <aside className="w-60 bg-white dark:bg-slate-800 border-r dark:border-slate-700 flex flex-col">
        <div className="p-5 border-b dark:border-slate-700 flex items-center gap-2">
          <Bike className="text-blue-600" size={24} />
          <span className="font-bold text-lg dark:text-white">CycloTrack</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
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
      </aside>
      <main className="flex-1 overflow-auto dark:text-slate-100">
        <Outlet />
      </main>
    </div>
  )
}
