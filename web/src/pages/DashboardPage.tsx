import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { api } from '@/lib/axios'
import { Stats, Ride } from '@/lib/types'
import { formatDuration, formatDateShort } from '@/lib/utils'
import StatCard from '@/components/StatCard'
import MonthlyProgressChart from '@/components/MonthlyProgressChart'
import { Bike, TrendingUp, Mountain, Flame, TrendingDown, Minus } from 'lucide-react'

const PERIODS = [
  { key: '7d',  label: '7 jours',  days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '3m',  label: '3 mois',   days: 90 },
  { key: '1y',  label: '1 an',     days: 365 },
] as const
type PeriodKey = typeof PERIODS[number]['key']

function Delta({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 1) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus size={10} /> 0%</span>
  const up = pct > 0
  return (
    <span className={`text-xs flex items-center gap-0.5 font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct.toFixed(0)}%
    </span>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>('30d')

  const { data: stats, isLoading: loadingStats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then(r => r.data),
  })

  const { data: allRides = [] } = useQuery<Ride[]>({
    queryKey: ['rides', 'chart'],
    queryFn: () => api.get('/rides?pageSize=200').then(r => r.data),
  })

  const days = PERIODS.find(p => p.key === period)!.days
  const now = Date.now()
  const cutoff = now - days * 86400000
  const prevCutoff = cutoff - days * 86400000

  const rides = useMemo(
    () => allRides.filter(r => new Date(r.startedAt).getTime() >= cutoff),
    [allRides, cutoff]
  )
  const prevRides = useMemo(
    () => allRides.filter(r => {
      const t = new Date(r.startedAt).getTime()
      return t >= prevCutoff && t < cutoff
    }),
    [allRides, cutoff, prevCutoff]
  )

  const kpi = useMemo(() => ({
    rides: rides.length,
    distance: rides.reduce((s, r) => s + r.distanceKm, 0),
    elevation: rides.reduce((s, r) => s + r.elevationGainM, 0),
    calories: rides.reduce((s, r) => s + (r.caloriesBurned ?? 0), 0),
  }), [rides])

  const prevKpi = useMemo(() => ({
    rides: prevRides.length,
    distance: prevRides.reduce((s, r) => s + r.distanceKm, 0),
    elevation: prevRides.reduce((s, r) => s + r.elevationGainM, 0),
    calories: prevRides.reduce((s, r) => s + (r.caloriesBurned ?? 0), 0),
  }), [prevRides])

  const chartData = [...rides].reverse().map(r => ({
    date: formatDateShort(r.startedAt),
    distance: parseFloat(r.distanceKm.toFixed(1)),
    watts: r.avgWatts && r.avgWatts > 0 ? r.avgWatts : null,
    bpm: r.avgBpm && r.avgBpm > 0 ? r.avgBpm : null,
    elevation: parseFloat(r.elevationGainM.toFixed(0)),
  }))

  const hasWatts = chartData.some(d => d.watts != null)
  const hasBpm = chartData.some(d => d.bpm != null)

  if (loadingStats) return <div className="p-8 text-gray-400 dark:text-slate-500">Chargement...</div>

  return (
    <div className="p-6 md:p-8 space-y-6 md:space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
        {/* Sélecteur de période */}
        <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs avec delta N vs N-1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Bike size={20} className="text-white" />}
          label="Sorties"
          value={String(kpi.rides)}
          color="bg-blue-500"
          sub={<Delta curr={kpi.rides} prev={prevKpi.rides} />}
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-white" />}
          label="Distance"
          value={`${kpi.distance.toFixed(0)} km`}
          color="bg-green-500"
          sub={<Delta curr={kpi.distance} prev={prevKpi.distance} />}
        />
        <StatCard
          icon={<Mountain size={20} className="text-white" />}
          label="Dénivelé"
          value={`${kpi.elevation.toFixed(0)} m`}
          color="bg-orange-500"
          sub={<Delta curr={kpi.elevation} prev={prevKpi.elevation} />}
        />
        <StatCard
          icon={<Flame size={20} className="text-white" />}
          label="Calories"
          value={`${kpi.calories.toFixed(0)} kcal`}
          color="bg-red-500"
          sub={<Delta curr={kpi.calories} prev={prevKpi.calories} />}
        />
      </div>

      {/* Graphiques */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5">
            <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200">Distance par sortie (km)</h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gDist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="distance" stroke="#3b82f6" fill="url(#gDist)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5">
            <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200">Dénivelé positif par sortie (m)</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="elevation" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {hasWatts && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5">
              <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200">Puissance moyenne (W)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gWatts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="watts" stroke="#8b5cf6" fill="url(#gWatts)" strokeWidth={2} dot={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {hasBpm && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5">
              <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200">FC moyenne (bpm)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gBpm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="bpm" stroke="#ef4444" fill="url(#gBpm)" strokeWidth={2} dot={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Progression mensuelle */}
      {rides.length >= 2 && <MonthlyProgressChart rides={rides} />}

      {/* Dernières sorties */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Dernières sorties</h2>
          <Link to="/rides" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Voir tout</Link>
        </div>
        {!stats?.recentRides?.length ? (
          <p className="text-gray-400 dark:text-slate-500 text-sm">Aucune sortie enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 dark:text-slate-500 border-b dark:border-slate-700">
                <th className="pb-2">Date</th>
                <th className="pb-2">Distance</th>
                <th className="pb-2">Durée</th>
                <th className="pb-2">Vitesse moy.</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRides.map(r => (
                <tr key={r.id} className="border-b dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="py-2 text-gray-700 dark:text-slate-300">{new Date(r.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                  <td className="py-2 font-medium text-gray-900 dark:text-white">{r.distanceKm.toFixed(1)} km</td>
                  <td className="py-2 text-gray-700 dark:text-slate-300">{formatDuration(r.durationSec)}</td>
                  <td className="py-2 text-gray-700 dark:text-slate-300">{r.avgSpeedKmh.toFixed(1)} km/h</td>
                  <td className="py-2">
                    <Link to={`/rides/${r.id}`} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">Détail →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
