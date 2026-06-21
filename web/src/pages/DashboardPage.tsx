import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { api } from '@/lib/axios'
import { Stats, Ride } from '@/lib/types'
import { formatDuration, formatDateShort } from '@/lib/utils'
import StatCard from '@/components/StatCard'
import { Bike, TrendingUp, Mountain, Flame } from 'lucide-react'

export default function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then(r => r.data),
  })

  const { data: rides = [] } = useQuery<Ride[]>({
    queryKey: ['rides', 'chart'],
    queryFn: () => api.get('/rides?pageSize=30').then(r => r.data),
  })

  // Préparer données graphiques : 30 dernières sorties dans l'ordre chronologique
  const chartData = [...rides].reverse().map(r => ({
    date: formatDateShort(r.startedAt),
    distance: parseFloat(r.distanceKm.toFixed(1)),
    watts: r.avgWatts ?? 0,
    bpm: r.avgBpm ?? 0,
    elevation: parseFloat(r.elevationGainM.toFixed(0)),
  }))

  if (loadingStats) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Bike size={20} className="text-white" />}
          label="Sorties totales"
          value={String(stats?.totalRides ?? 0)}
          color="bg-blue-500"
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-white" />}
          label="Distance totale"
          value={`${((stats?.totalDistanceKm ?? 0)).toFixed(0)} km`}
          color="bg-green-500"
        />
        <StatCard
          icon={<Mountain size={20} className="text-white" />}
          label="Dénivelé cumulé"
          value={`${((stats?.totalElevationM ?? 0)).toFixed(0)} m`}
          color="bg-orange-500"
        />
        <StatCard
          icon={<Flame size={20} className="text-white" />}
          label="Calories brûlées"
          value={`${((stats?.totalCalories ?? 0)).toFixed(0)} kcal`}
          color="bg-red-500"
        />
      </div>

      {/* Graphiques */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold mb-4 text-gray-700">Distance par sortie (km)</h2>
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

          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold mb-4 text-gray-700">Dénivelé positif par sortie (m)</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="elevation" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {chartData.some(d => d.watts > 0) && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="font-semibold mb-4 text-gray-700">Puissance moyenne (W)</h2>
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
                  <Area type="monotone" dataKey="watts" stroke="#8b5cf6" fill="url(#gWatts)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartData.some(d => d.bpm > 0) && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="font-semibold mb-4 text-gray-700">FC moyenne (bpm)</h2>
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
                  <Area type="monotone" dataKey="bpm" stroke="#ef4444" fill="url(#gBpm)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Dernières sorties */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Dernières sorties</h2>
          <Link to="/rides" className="text-sm text-blue-600 hover:underline">Voir tout</Link>
        </div>
        {!stats?.recentRides?.length ? (
          <p className="text-gray-400 text-sm">Aucune sortie enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Distance</th>
                <th className="pb-2">Durée</th>
                <th className="pb-2">Vitesse moy.</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRides.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2">{new Date(r.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                  <td className="py-2 font-medium">{r.distanceKm.toFixed(1)} km</td>
                  <td className="py-2">{formatDuration(r.durationSec)}</td>
                  <td className="py-2">{r.avgSpeedKmh.toFixed(1)} km/h</td>
                  <td className="py-2">
                    <Link to={`/rides/${r.id}`} className="text-blue-600 hover:underline text-xs">Détail →</Link>
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
