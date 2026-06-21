import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Brain, Loader2 } from 'lucide-react'

interface Ride {
  id: string; startedAt: string; distanceKm: number; durationSec: number
  avgSpeedKmh: number; maxSpeedKmh: number; elevationGainM: number; elevationLossM: number
  avgWatts?: number; maxWatts?: number; avgBpm?: number; maxBpm?: number
  avgCadenceRpm?: number; caloriesBurned: number; feelBefore?: number
  commentBefore?: string; aiAnalysis?: string
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h${m.toString().padStart(2, '0')}`
}

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: ride, isLoading } = useQuery<Ride>({
    queryKey: ['ride', id],
    queryFn: () => api.get(`/rides/${id}`).then(r => r.data),
  })

  const { mutate: analyzeRide, isPending } = useMutation({
    mutationFn: () => api.post(`/rides/${id}/analyze`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ride', id] }),
  })

  if (isLoading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (!ride) return null

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">
        {new Date(ride.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </h1>
      <p className="text-gray-400 text-sm mb-6">{formatDuration(ride.durationSec)}</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Distance" value={`${ride.distanceKm.toFixed(1)} km`} />
        <Stat label="Vitesse moy." value={`${ride.avgSpeedKmh.toFixed(1)} km/h`} />
        <Stat label="Vitesse max" value={`${ride.maxSpeedKmh.toFixed(1)} km/h`} />
        <Stat label="Dénivelé +" value={`${ride.elevationGainM.toFixed(0)} m`} />
        <Stat label="Dénivelé -" value={`${ride.elevationLossM.toFixed(0)} m`} />
        <Stat label="Calories" value={`${ride.caloriesBurned.toFixed(0)} kcal`} />
        {ride.avgWatts && <Stat label="Puissance moy." value={`${ride.avgWatts.toFixed(0)} W`} />}
        {ride.maxWatts && <Stat label="Puissance max" value={`${ride.maxWatts.toFixed(0)} W`} />}
        {ride.avgCadenceRpm && <Stat label="Cadence moy." value={`${ride.avgCadenceRpm.toFixed(0)} rpm`} />}
        {ride.avgBpm && <Stat label="FC moy." value={`${ride.avgBpm} bpm`} />}
        {ride.maxBpm && <Stat label="FC max" value={`${ride.maxBpm} bpm`} />}
      </div>

      {ride.feelBefore && (
        <p className="text-sm text-gray-500 mb-6">
          Ressenti avant la sortie : {'⭐'.repeat(ride.feelBefore)}
          {ride.commentBefore && ` — "${ride.commentBefore}"`}
        </p>
      )}

      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold">
            <Brain size={18} className="text-purple-600" />
            Analyse coach IA
          </div>
          {!ride.aiAnalysis && (
            <button
              onClick={() => analyzeRide()}
              disabled={isPending}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isPending ? 'Analyse en cours...' : 'Obtenir le bilan coach'}
            </button>
          )}
        </div>
        {ride.aiAnalysis ? (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ride.aiAnalysis}</div>
        ) : (
          <p className="text-sm text-gray-400">Cliquez sur "Obtenir le bilan coach" pour recevoir une analyse personnalisée de cette sortie.</p>
        )}
      </div>
    </div>
  )
}
