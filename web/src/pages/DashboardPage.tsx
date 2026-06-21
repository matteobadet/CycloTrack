import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Bike, TrendingUp, Mountain, Flame } from 'lucide-react'

interface Stats {
  totalRides: number
  totalDistanceKm: number
  totalElevationM: number
  totalCalories: number
  recentRides: { id: string; startedAt: string; distanceKm: number; durationSec: number; avgSpeedKmh: number }[]
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then(r => r.data),
  })

  if (isLoading) return <div className="p-8 text-gray-400">Chargement...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={Bike} label="Sorties" value={String(stats?.totalRides ?? 0)} color="bg-blue-500" />
        <StatCard icon={TrendingUp} label="Distance totale" value={`${(stats?.totalDistanceKm ?? 0).toFixed(0)} km`} color="bg-green-500" />
        <StatCard icon={Mountain} label="Dénivelé cumulé" value={`${(stats?.totalElevationM ?? 0).toFixed(0)} m`} color="bg-orange-500" />
        <StatCard icon={Flame} label="Calories brûlées" value={`${(stats?.totalCalories ?? 0).toFixed(0)} kcal`} color="bg-red-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="font-semibold mb-4">Dernières sorties</h2>
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
              </tr>
            </thead>
            <tbody>
              {stats.recentRides.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(r.startedAt).toLocaleDateString('fr-FR')}</td>
                  <td className="py-2">{r.distanceKm.toFixed(1)} km</td>
                  <td className="py-2">{formatDuration(r.durationSec)}</td>
                  <td className="py-2">{r.avgSpeedKmh.toFixed(1)} km/h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
