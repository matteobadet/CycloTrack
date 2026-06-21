import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import 'leaflet/dist/leaflet.css'
import { api } from '@/lib/axios'
import { Ride, RidePoint } from '@/lib/types'
import { formatDuration, formatDate } from '@/lib/utils'
import { Brain, Loader2, ArrowLeft } from 'lucide-react'

interface RideDetail { ride: Ride; points: RidePoint[] }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<RideDetail>({
    queryKey: ['ride', id],
    queryFn: () => api.get(`/rides/${id}`).then(r => r.data),
  })

  const { mutate: analyze, isPending } = useMutation({
    mutationFn: () => api.post(`/rides/${id}/analyze`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ride', id] }),
  })

  if (isLoading) return <div className="p-8 text-gray-400">Chargement...</div>
  if (!data) return null

  const { ride, points } = data
  const coords = points.map(p => [p.lat, p.lng] as [number, number])
  const center = coords.length ? coords[Math.floor(coords.length / 2)] : [46.2, 2.2] as [number, number]

  // Données graphiques altitude / vitesse
  const chartData = points.filter((_, i) => i % 5 === 0).map(p => ({
    alt: p.altitudeM ? Math.round(p.altitudeM) : null,
    speed: p.speedKmh ? parseFloat(p.speedKmh.toFixed(1)) : null,
    watts: p.watts ?? null,
    bpm: p.bpm ?? null,
  }))

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/rides" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour aux sorties
      </Link>

      <h1 className="text-2xl font-bold mb-1">{formatDate(ride.startedAt)}</h1>
      <p className="text-gray-400 text-sm mb-6">{formatDuration(ride.durationSec)}</p>

      {/* Carte */}
      {coords.length > 1 && (
        <div className="rounded-xl overflow-hidden border mb-6 h-64">
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

      {/* Graphique altitude */}
      {chartData.some(d => d.alt != null) && (
        <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-3 text-gray-700">Profil altimétrique (m)</h2>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gAlt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis hide />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [`${v} m`, 'Altitude']} />
              <Area type="monotone" dataKey="alt" stroke="#f97316" fill="url(#gAlt)" strokeWidth={2} dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ressenti avant */}
      {ride.feelBefore != null && (
        <p className="text-sm text-gray-500 mb-6">
          Ressenti avant la sortie : {'⭐'.repeat(ride.feelBefore)}
          {ride.commentBefore && ` — "${ride.commentBefore}"`}
        </p>
      )}

      {/* Bilan IA */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold">
            <Brain size={18} className="text-purple-600" />
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
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ride.aiAnalysis}</div>
        ) : (
          <p className="text-sm text-gray-400">Cliquez sur "Obtenir le bilan coach" pour recevoir une analyse personnalisée.</p>
        )}
      </div>
    </div>
  )
}
