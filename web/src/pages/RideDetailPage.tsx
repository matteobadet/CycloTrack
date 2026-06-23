import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '@/lib/axios'
import { Ride, RidePoint } from '@/lib/types'
import { formatDuration, formatDate } from '@/lib/utils'
import { Brain, Loader2, ArrowLeft, Trophy, Share2, Check } from 'lucide-react'
import AiCoachAnalysis from '@/components/AiCoachAnalysis'
import RidePerformanceChart from '@/components/RidePerformanceChart'
import HrZonesChart from '@/components/HrZonesChart'
import { useAuthStore } from '@/stores/authStore'

interface MusicInsight {
  emoji: string
  title: string
  description: string
  trackName: string
  artistName: string
  albumArtUrl?: string
}

interface RideDetail { ride: Ride; points: RidePoint[]; musicInsights: MusicInsight[] }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{label}</p>
    </div>
  )
}

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const { data: similar } = useQuery<{
    count: number
    best: { id: string; startedAt: string; distanceKm: number; durationSec: number; avgSpeedKmh: number } | null
    history: { id: string; startedAt: string; distanceKm: number; durationSec: number; avgSpeedKmh: number }[]
  }>({
    queryKey: ['ride-similar', id],
    queryFn: () => api.get(`/rides/${id}/similar`).then(r => r.data),
    enabled: !!id,
  })

  const { data, isLoading } = useQuery<RideDetail>({
    queryKey: ['ride', id],
    queryFn: () => api.get(`/rides/${id}`).then(r => r.data),
  })

  const [copied, setCopied] = useState(false)

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const { mutate: analyze, isPending } = useMutation({
    mutationFn: () => api.post(`/rides/${id}/analyze`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ride', id] }),
  })

  if (isLoading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (!data) return null

  const { ride, points, musicInsights } = data
  const coords = points.map(p => [p.lat, p.lng] as [number, number])
  const center = coords.length ? coords[Math.floor(coords.length / 2)] : [46.2, 2.2] as [number, number]

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/rides" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour aux sorties
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">{formatDate(ride.startedAt)}</h1>
          <p className="text-gray-400 dark:text-slate-500 text-sm">{formatDuration(ride.durationSec)}</p>
        </div>
        <button
          onClick={handleShare}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            copied
              ? 'border-green-400 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500'
          }`}
        >
          {copied ? <Check size={14} /> : <Share2 size={14} />}
          {copied ? 'Lien copié !' : 'Partager'}
        </button>
      </div>

      {/* Carte */}
      {coords.length > 1 && (
        <div className="rounded-xl overflow-hidden border dark:border-slate-700 mb-6 h-64">
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline positions={coords} color="#2563eb" weight={4} />
          </MapContainer>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Distance" value={`${ride.distanceKm.toFixed(1)} km`} />
        <Stat label="Vitesse moy." value={`${ride.avgSpeedKmh.toFixed(1)} km/h`} />
        <Stat label="Vitesse max" value={`${ride.maxSpeedKmh.toFixed(1)} km/h`} />
        <Stat label="Dénivelé +" value={`${ride.elevationGainM.toFixed(0)} m`} />
        <Stat label="Dénivelé -" value={`${ride.elevationLossM.toFixed(0)} m`} />
        <Stat label="Calories" value={`${ride.caloriesBurned.toFixed(0)} kcal`} />
        {ride.avgWatts != null && <Stat label="Puissance moy." value={`${ride.avgWatts.toFixed(0)} W`} />}
        {ride.maxWatts != null && <Stat label="Puissance max" value={`${ride.maxWatts.toFixed(0)} W`} />}
        {ride.avgCadenceRpm != null && <Stat label="Cadence moy." value={`${ride.avgCadenceRpm.toFixed(0)} rpm`} />}
        {ride.avgBpm != null && <Stat label="FC moy." value={`${ride.avgBpm} bpm`} />}
        {ride.maxBpm != null && <Stat label="FC max" value={`${ride.maxBpm} bpm`} />}
      </div>

      {/* Graphique performance superposé */}
      {points.length > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-3 text-gray-700 dark:text-slate-200">Analyse de performance</h2>
          <RidePerformanceChart points={points} />
        </div>
      )}

      {/* Zones d'effort FC */}
      {points.some(p => p.bpm != null) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200">Zones d'effort cardiaques</h2>
          <HrZonesChart points={points} maxHrBpm={user?.maxHrBpm} />
        </div>
      )}

      {/* Ressenti avant */}
      {ride.feelBefore != null && (
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Ressenti avant la sortie : {'⭐'.repeat(ride.feelBefore)}
          {ride.commentBefore && ` — "${ride.commentBefore}"`}
        </p>
      )}

      {/* Insights musicaux */}
      {musicInsights?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200 flex items-center gap-2">
            🎵 Musique & performance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {musicInsights.map((ins, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                {ins.albumArtUrl ? (
                  <img src={ins.albumArtUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0 text-xl">🎵</div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-0.5">
                    {ins.emoji} {ins.title}
                  </p>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{ins.trackName}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{ins.artistName}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{ins.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparaison sorties similaires */}
      {similar && similar.count > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-4 text-gray-700 dark:text-slate-200 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            Sorties similaires
            <span className="text-xs font-normal text-gray-400 dark:text-slate-500">
              — {similar.count} fois ce trajet
            </span>
          </h2>

          {/* Record personnel */}
          {similar.best && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg px-4 py-3 mb-4 flex items-center gap-4">
              <span className="text-2xl">🏆</span>
              <div className="flex-1">
                <p className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold uppercase tracking-wide mb-0.5">
                  Ton record
                </p>
                <p className="text-sm font-bold text-gray-800 dark:text-white">
                  {formatDuration(similar.best.durationSec)} — {similar.best.avgSpeedKmh.toFixed(1)} km/h moy.
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {formatDate(similar.best.startedAt)}
                </p>
              </div>
              {/* Compare with current ride */}
              {similar.best.id !== id && ride && (
                <div className="text-right">
                  <p className={`text-sm font-bold ${ride.durationSec <= similar.best.durationSec ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {ride.durationSec <= similar.best.durationSec ? '🎉 Nouveau record !' : `+${formatDuration(ride.durationSec - similar.best.durationSec)}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Historique */}
          <div className="space-y-2">
            {similar.history.slice(0, 5).map((r, i) => (
              <Link key={r.id} to={`/rides/${r.id}`}
                className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="text-gray-400 dark:text-slate-500 w-4 text-right">{i + 1}</span>
                <span className="text-gray-500 dark:text-slate-400 flex-1">
                  {new Date(r.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
                <span className="font-medium text-gray-800 dark:text-white">{formatDuration(r.durationSec)}</span>
                <span className="text-gray-400 dark:text-slate-500">{r.avgSpeedKmh.toFixed(1)} km/h</span>
                {r.id === similar.best?.id && <span className="text-yellow-500 text-xs">🏆</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bilan IA */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
            <Brain size={18} className="text-purple-600 dark:text-purple-400" />
            Analyse coach IA
          </div>
          {!ride.aiAnalysis && (
            <button
              onClick={() => analyze()}
              disabled={isPending}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isPending ? 'Analyse en cours...' : 'Obtenir le bilan coach'}
            </button>
          )}
        </div>
        {ride.aiAnalysis ? (
          <AiCoachAnalysis analysis={ride.aiAnalysis} />
        ) : (
          <p className="text-sm text-gray-400 dark:text-slate-500">Cliquez sur "Obtenir le bilan coach" pour recevoir une analyse personnalisée.</p>
        )}
      </div>
    </div>
  )
}
