import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { api } from '@/lib/axios'
import { Stats, Ride } from '@/lib/types'
import { formatDuration, formatDateShort } from '@/lib/utils'
import StatCard from '@/components/StatCard'
import MonthlyProgressChart from '@/components/MonthlyProgressChart'
import { Bike, TrendingUp, Mountain, Flame, TrendingDown, Minus, Activity } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const PERIODS = [
  { key: '7d',  label: '7 jours',  days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '3m',  label: '3 mois',   days: 90 },
  { key: '1y',  label: '1 an',     days: 365 },
] as const
type PeriodKey = typeof PERIODS[number]['key']

// TSS/CTL/ATL computation
// TSS per ride: if power available → (durationSec × avgWatts²)/(ftp² × 3600) × 100
// Fallback (HR): (durationSec/3600) × (avgBpm/maxBpm)² × 100
// Fallback (none): (durationSec/3600) × 50  (flat ~50 TSS/h estimate)
function computeTss(ride: Ride, ftp: number, maxHrBpm: number): number {
  const hours = ride.durationSec / 3600
  if (ride.avgWatts && ride.avgWatts > 0 && ftp > 0) {
    const IF = ride.avgWatts / ftp
    return hours * IF * IF * 100
  }
  if (ride.avgBpm && ride.avgBpm > 0 && maxHrBpm > 0) {
    const hrFrac = ride.avgBpm / maxHrBpm
    return hours * hrFrac * hrFrac * 100
  }
  return hours * 50
}

function ema(days: number) { return Math.exp(-1 / days) }

interface FitnessMetrics { ctl: number; atl: number; tsb: number; todayTss: number }

function computeFitness(rides: Ride[], ftp: number, maxHrBpm: number): FitnessMetrics {
  const k42 = ema(42), k7 = ema(7)
  // Build a day-keyed map of TSS
  const tssMap = new Map<string, number>()
  for (const r of rides) {
    const day = r.startedAt.slice(0, 10)
    tssMap.set(day, (tssMap.get(day) ?? 0) + computeTss(r, ftp, maxHrBpm))
  }
  // Iterate daily from 90 days ago to today
  let ctl = 0, atl = 0
  const today = new Date()
  let todayTss = 0
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const tss = tssMap.get(key) ?? 0
    if (i === 0) todayTss = tss
    ctl = ctl * k42 + tss * (1 - k42)
    atl = atl * k7  + tss * (1 - k7)
  }
  return { ctl, atl, tsb: ctl - atl, todayTss }
}

function FitnessWidget({ rides, ftp, maxHrBpm }: { rides: Ride[]; ftp: number; maxHrBpm: number }) {
  const { ctl, atl, tsb, todayTss } = useMemo(
    () => computeFitness(rides, ftp, maxHrBpm),
    [rides, ftp, maxHrBpm]
  )

  const tsbColor = tsb > 5 ? 'text-green-600 dark:text-green-400'
    : tsb < -10 ? 'text-red-500 dark:text-red-400'
    : 'text-yellow-500 dark:text-yellow-400'

  const tsbLabel = tsb > 5 ? 'Forme ✓' : tsb < -10 ? 'Fatigue ⚠' : 'Neutre'

  const hasPower = rides.some(r => r.avgWatts && r.avgWatts > 0)
  const hasFtp = ftp > 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-2">
          <Activity size={16} className="text-indigo-500" />
          Forme & charge
        </h2>
        {!hasFtp && (
          <Link to="/profile" className="text-xs text-blue-500 dark:text-blue-400 hover:underline">
            Renseigne ton FTP pour plus de précision →
          </Link>
        )}
        {hasFtp && !hasPower && (
          <span className="text-xs text-gray-400 dark:text-slate-500">Estimation via FC</span>
        )}
        {hasFtp && hasPower && (
          <span className="text-xs text-gray-400 dark:text-slate-500">Basé sur la puissance</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="text-center bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{ctl.toFixed(0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">CTL</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">Condition</p>
        </div>
        <div className="text-center bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <p className="text-xl font-bold text-orange-500 dark:text-orange-400">{atl.toFixed(0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">ATL</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">Fatigue</p>
        </div>
        <div className={`text-center rounded-lg p-3 ${tsb >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <p className={`text-xl font-bold ${tsbColor}`}>{tsb > 0 ? '+' : ''}{tsb.toFixed(0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">TSB</p>
          <p className={`text-xs font-medium ${tsbColor}`}>{tsbLabel}</p>
        </div>
        <div className="text-center bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
          <p className="text-xl font-bold text-gray-700 dark:text-slate-200">{todayTss.toFixed(0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">TSS</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">Aujourd'hui</p>
        </div>
      </div>

      {/* Interprétation */}
      <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-3 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
        <span className="font-semibold text-gray-600 dark:text-slate-300">Comment lire ces chiffres :</span>{' '}
        <span className="text-indigo-500 dark:text-indigo-400 font-medium">CTL</span> = ta condition sur 42j (↑ = plus entraîné).{' '}
        <span className="text-orange-500 dark:text-orange-400 font-medium">ATL</span> = fatigue récente (7j).{' '}
        <span className={`font-medium ${tsbColor}`}>TSB = CTL − ATL</span> : positif → reposé, négatif → fatigué.
      </div>
    </div>
  )
}

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
  const user = useAuthStore(s => s.user)

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

      {/* Widget forme */}
      {allRides.length >= 3 && (
        <FitnessWidget
          rides={allRides}
          ftp={user?.ftp || 0}
          maxHrBpm={user?.maxHrBpm || 190}
        />
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
