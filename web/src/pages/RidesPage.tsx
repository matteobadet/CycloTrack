import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/axios'
import { Bike, ChevronRight } from 'lucide-react'

interface Ride {
  id: string
  startedAt: string
  distanceKm: number
  durationSec: number
  avgSpeedKmh: number
  elevationGainM: number
  avgWatts?: number
  avgBpm?: number
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

export default function RidesPage() {
  const { data: rides = [], isLoading } = useQuery<Ride[]>({
    queryKey: ['rides'],
    queryFn: () => api.get('/rides').then(r => r.data),
  })

  if (isLoading) return <div className="p-8 text-gray-400 dark:text-slate-500">Chargement...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Mes sorties</h1>
      {rides.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-12 text-center text-gray-400 dark:text-slate-500">
          <Bike size={48} className="mx-auto mb-3 opacity-30" />
          <p>Aucune sortie pour l'instant.</p>
          <p className="text-sm mt-1">Lancez l'app mobile pour enregistrer votre première sortie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rides.map(r => (
            <Link
              key={r.id}
              to={`/rides/${r.id}`}
              className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Bike size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(r.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <p className="text-sm text-gray-400 dark:text-slate-500">{formatDuration(r.durationSec)}</p>
                </div>
              </div>
              <div className="flex items-center gap-8 text-sm text-gray-600 dark:text-slate-300">
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{r.distanceKm.toFixed(1)} km</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Distance</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{r.avgSpeedKmh.toFixed(1)} km/h</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Vitesse moy.</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{r.elevationGainM.toFixed(0)} m</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Dénivelé</p>
                </div>
                {r.avgWatts && (
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">{r.avgWatts.toFixed(0)} W</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Puissance</p>
                  </div>
                )}
              </div>
              <ChevronRight size={20} className="text-gray-300 dark:text-slate-600" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
