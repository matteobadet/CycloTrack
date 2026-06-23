import { useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import GradientPolyline, { GradientLegend } from '@/components/GradientPolyline'
import ColStats from '@/components/ColStats'
import WeatherForecast from '@/components/WeatherForecast'
import L from 'leaflet'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import 'leaflet/dist/leaflet.css'
import { api } from '@/lib/axios'
import { computeRoute, RouteData } from '@/lib/routing'
import { parseGpx } from '@/lib/gpx'
import { Loader2, MapPin, Brain, AlertCircle, Save, Calendar, Trash2, Edit2, Check, Upload } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface PlanPoi {
  lat: number
  lng: number
  type: 'fontaine' | 'cafe' | 'vue' | 'danger'
  label: string
}

const POI_TYPES: { value: PlanPoi['type']; emoji: string; label: string }[] = [
  { value: 'fontaine', emoji: '💧', label: 'Fontaine' },
  { value: 'cafe',     emoji: '☕', label: 'Café / ravito' },
  { value: 'vue',      emoji: '👀', label: 'Vue panoramique' },
  { value: 'danger',   emoji: '⚠️', label: 'Danger / attention' },
]

const POI_ICON: Record<PlanPoi['type'], L.DivIcon> = Object.fromEntries(
  POI_TYPES.map(p => [
    p.value,
    L.divIcon({ html: `<div style="font-size:22px;line-height:1;">${p.emoji}</div>`, className: '', iconSize: [28, 28], iconAnchor: [14, 28] })
  ])
) as Record<PlanPoi['type'], L.DivIcon>

// Fix default Leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })

type Difficulty = 'beginner' | 'medium' | 'hard' | 'pro'
const DIFFICULTIES: { value: Difficulty; label: string; emoji: string; desc: string; sub: string; color: string; ring: string }[] = [
  { value: 'beginner', label: 'Débutant',  emoji: '🟢', desc: 'Sortie tranquille',  sub: 'Z1-Z2 · < 60% FTP · Conversation possible',      color: 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300',  ring: 'ring-green-400' },
  { value: 'medium',   label: 'Médium',    emoji: '🔵', desc: 'Effort modéré',      sub: 'Z2-Z3 · 60-75% FTP · Respiration soutenue',        color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',      ring: 'ring-blue-400' },
  { value: 'hard',     label: 'Difficile', emoji: '🟠', desc: 'Sortie engagée',     sub: 'Z3-Z4 · 75-90% FTP · Difficile de parler',         color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300', ring: 'ring-orange-400' },
  { value: 'pro',      label: 'Pro',       emoji: '🔴', desc: 'Effort maximal',     sub: 'Z4-Z5 · > 90% FTP · Compétition / interval',       color: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300',          ring: 'ring-red-500' },
]

// --- Waypoint parsing ---
function parseWaypoints(url: string): [number, number][] {
  // /dir/ path segments
  const dirMatch = url.match(/\/dir\/([^@?#]+)/)
  if (dirMatch) {
    const segments = dirMatch[1].split('/').filter(Boolean)
    const coords: [number, number][] = []
    for (const seg of segments) {
      const m = seg.match(/^(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)$/)
      if (m) {
        const lat = parseFloat(m[1]), lng = parseFloat(m[2])
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) coords.push([lat, lng])
      }
    }
    if (coords.length >= 2) return coords
  }
  // !3d/!4d encoded waypoints
  const lats = [...url.matchAll(/!3d(-?\d+\.\d+)/g)].map(m => parseFloat(m[1]))
  const lngs = [...url.matchAll(/!4d(-?\d+\.\d+)/g)].map(m => parseFloat(m[1]))
  if (lats.length >= 2 && lats.length === lngs.length) return lats.map((lat, i) => [lat, lngs[i]])
  // fallback: all pairs excluding viewport
  const viewportMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),/)
  const vpKey = viewportMatch ? `${parseFloat(viewportMatch[1]).toFixed(4)},${parseFloat(viewportMatch[2]).toFixed(4)}` : ''
  const pattern = /(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/g
  const seen = new Set<string>()
  const result: [number, number][] = []
  for (const m of [...url.matchAll(pattern)]) {
    const lat = parseFloat(m[1]), lng = parseFloat(m[2])
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    if (key === vpKey || seen.has(key)) continue
    seen.add(key); result.push([lat, lng])
  }
  return result
}


function MapClickHandler({ editMode, poiMode, onMapClick, onPoiClick }: { editMode: boolean; poiMode: boolean; onMapClick: (lat: number, lng: number) => void; onPoiClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (poiMode) onPoiClick(e.latlng.lat, e.latlng.lng)
      else if (editMode) onMapClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

// Draggable marker icons
const startIcon = new L.Icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] })

export default function PlanPage() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [plannedAt, setPlannedAt] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<RouteData | null>(null)
  const [waypoints, setWaypoints] = useState<[number, number][]>([])
  const [editMode, setEditMode] = useState(false)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  // POI state
  const [pois, setPois] = useState<PlanPoi[]>([])
  const [poiMode, setPoiMode] = useState(false)
  const [pendingPoi, setPendingPoi] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingPoiType, setPendingPoiType] = useState<PlanPoi['type']>('fontaine')
  const [pendingPoiLabel, setPendingPoiLabel] = useState('')
  const gpxInputRef = useRef<HTMLInputElement>(null)


  async function handleGpxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setAiAdvice(null); setSavedId(null)
    setLoading(true)
    try {
      const text = await file.text()
      const gpxData = parseGpx(text)
      setRoute(gpxData as any)
      setWaypoints([gpxData.coords[0], gpxData.coords[gpxData.coords.length - 1]])
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l\'import GPX.')
    } finally {
      setLoading(false)
      if (gpxInputRef.current) gpxInputRef.current.value = ''
    }
  }

  async function handleAnalyze() {
    setError(null); setRoute(null); setAiAdvice(null); setSavedId(null)
    setLoading(true)
    try {
      const wps = parseWaypoints(url)
      if (wps.length < 2) throw new Error('Impossible d\'extraire les points de départ/arrivée. Colle une URL Google Maps avec itinéraire (google.fr/maps/dir/...).')
      const r = await computeRoute(wps)
      setRoute(r)
      setWaypoints(wps)
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l\'analyse.')
    } finally {
      setLoading(false)
    }
  }

  async function handleManualRoute() {
    if (waypoints.length < 2) { setError('Ajoute au moins 2 points sur la carte.'); return }
    setError(null); setRecalcLoading(true)
    try {
      const r = await computeRoute(waypoints)
      setRoute(r); setAiAdvice(null); setSavedId(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRecalcLoading(false)
    }
  }

  async function handleRecalc() {
    if (waypoints.length < 2) return
    setError(null); setRecalcLoading(true)
    try {
      const r = await computeRoute(waypoints)
      setRoute(r); setAiAdvice(null); setSavedId(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRecalcLoading(false)
    }
  }

  function handleMapClick(lat: number, lng: number) {
    setWaypoints(prev => [...prev, [lat, lng]])
  }

  function removeWaypoint(i: number) {
    setWaypoints(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateWaypoint(i: number, lat: number, lng: number) {
    setWaypoints(prev => prev.map((wp, idx) => idx === i ? [lat, lng] : wp))
  }

  async function handleAiPlan() {
    if (!route) return
    setLoadingAi(true)
    try {
      const res = await api.post('/plan/ai', {
        distanceKm: route.distanceKm,
        elevationGainM: route.elevationGainM,
        elevationLossM: route.elevationLossM,
        estimatedDurationMin: route.durationEstMin,
        difficulty,
        plannedAt: plannedAt ? new Date(plannedAt).toISOString() : undefined,
        keyPoints: route.keyPoints,
      })
      setAiAdvice(res.data.advice)
    } catch {
      setError('Impossible d\'obtenir le conseil IA.')
    } finally {
      setLoadingAi(false)
    }
  }

  async function handleSave() {
    if (!route) return
    setSaving(true)
    try {
      const res = await api.post('/plan/save', {
        title: title || `Sortie ${route.distanceKm.toFixed(0)} km`,
        distanceKm: route.distanceKm,
        elevationGainM: route.elevationGainM,
        elevationLossM: route.elevationLossM,
        estimatedDurationMin: route.durationEstMin,
        plannedAt: plannedAt ? new Date(plannedAt).toISOString() : undefined,
        routePolyline: route.encodedPolyline,
        googleMapsUrl: url || undefined,
        aiAdvice: aiAdvice || undefined,
        routeStepsJson: JSON.stringify((route as any).steps ?? []),
        elevationJson: JSON.stringify(route.elevProfile),
        poisJson: pois.length > 0 ? JSON.stringify(pois) : undefined,
      })
      setSavedId(res.data.id)
    } catch {
      setError('Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const center: [number, number] = route?.coords.length
    ? route.coords[Math.floor(route.coords.length / 2)]
    : waypoints.length ? waypoints[Math.floor(waypoints.length / 2)]
    : [46.5, 2.5]

  const mapZoom = route?.coords.length ? 13 : 6

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">Planifier une sortie</h1>
      <p className="text-gray-400 dark:text-slate-500 text-sm mb-6">Colle un lien Google Maps ou dessine ton itinéraire à la main.</p>

      {/* URL + Analyze + GPX import */}
      <div className="flex gap-3 mb-4">
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://www.google.fr/maps/dir/..."
          className="flex-1 border dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={handleAnalyze} disabled={loading || !url}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
          {loading ? 'Analyse...' : 'Analyser URL'}
        </button>
        <button onClick={() => gpxInputRef.current?.click()} disabled={loading}
          className="flex items-center gap-2 border dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">
          <Upload size={15} /> Import GPX
        </button>
        <input ref={gpxInputRef} type="file" accept=".gpx" className="hidden" onChange={handleGpxImport} />
      </div>

      {/* Title + Date */}
      <div className="flex gap-3 mb-4">
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Nom de la sortie"
          className="flex-1 border dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="datetime-local" value={plannedAt} onChange={e => setPlannedAt(e.target.value)}
            className="pl-9 border dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Difficulty */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Intensité de la sortie</p>
        <div className="grid grid-cols-4 gap-2">
          {DIFFICULTIES.map(d => (
            <button key={d.value} onClick={() => setDifficulty(d.value)}
              className={`text-left px-3 py-3 rounded-xl border-2 transition-all ${difficulty === d.value ? `${d.color} ring-2 ${d.ring} ring-offset-1 shadow-sm` : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{d.emoji}</span>
                <span className={`text-sm font-bold ${difficulty === d.value ? '' : 'text-gray-800 dark:text-white'}`}>{d.label}</span>
              </div>
              <p className={`text-xs font-medium mb-0.5 ${difficulty === d.value ? '' : 'text-gray-600 dark:text-slate-300'}`}>{d.desc}</p>
              <p className={`text-xs leading-tight ${difficulty === d.value ? 'opacity-70' : 'text-gray-400 dark:text-slate-500'}`}>{d.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Map always visible after first load or in edit mode */}
      <div className="rounded-xl overflow-hidden border dark:border-slate-700 h-80 mb-4 relative">
        <MapContainer center={center} zoom={mapZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler
            editMode={editMode} poiMode={poiMode}
            onMapClick={handleMapClick}
            onPoiClick={(lat, lng) => { setPendingPoi({ lat, lng }); setPendingPoiLabel('') }}
          />
          {route && <GradientPolyline coords={route.coords} elevations={route.elevations} />}
          {editMode && waypoints.map((wp, i) => (
            <Marker key={i} position={wp} draggable icon={startIcon}
              eventHandlers={{ dragend: (e: any) => { const ll = e.target.getLatLng(); updateWaypoint(i, ll.lat, ll.lng) } }}
            />
          ))}
          {pois.map((poi, i) => (
            <Marker key={`poi-${i}`} position={[poi.lat, poi.lng]} icon={POI_ICON[poi.type]}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{POI_TYPES.find(t => t.value === poi.type)?.emoji} {poi.label || POI_TYPES.find(t => t.value === poi.type)?.label}</p>
                  <button onClick={() => setPois(p => p.filter((_, idx) => idx !== i))} className="text-xs text-red-500 hover:underline mt-1">Supprimer</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Toolbar overlay */}
        <div className="absolute bottom-3 right-3 z-[1000] flex gap-2">
          {route && (
            <button onClick={() => { setPoiMode(m => !m); setEditMode(false); setPendingPoi(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md ${poiMode ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-white border dark:border-slate-600'}`}>
              📍 {poiMode ? 'Ajout POI ON' : 'Ajouter POI'}
            </button>
          )}
          <button onClick={() => { setEditMode(e => !e); setPoiMode(false); setPendingPoi(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md ${editMode ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-white border dark:border-slate-600'}`}>
            <Edit2 size={12} />{editMode ? 'Mode édition ON' : 'Modifier itinéraire'}
          </button>
          {editMode && waypoints.length >= 2 && (
            <button onClick={handleRecalc} disabled={recalcLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md bg-blue-600 text-white disabled:opacity-50">
              {recalcLoading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Recalculer
            </button>
          )}
        </div>

        {/* POI placement popup */}
        {pendingPoi && (
          <div className="absolute bottom-14 left-3 z-[1001] bg-white dark:bg-slate-800 rounded-xl shadow-xl border dark:border-slate-700 p-4 w-64">
            <p className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Ajouter un point d'intérêt</p>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {POI_TYPES.map(pt => (
                <button key={pt.value} onClick={() => setPendingPoiType(pt.value)}
                  className={`text-xs px-2 py-1.5 rounded-lg border text-left flex items-center gap-1 ${pendingPoiType === pt.value ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'}`}>
                  {pt.emoji} {pt.label}
                </button>
              ))}
            </div>
            <input value={pendingPoiLabel} onChange={e => setPendingPoiLabel(e.target.value)}
              placeholder="Note (optionnel)"
              className="w-full text-xs border dark:border-slate-600 rounded-lg px-2 py-1.5 mb-2 bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => {
                setPois(p => [...p, { lat: pendingPoi.lat, lng: pendingPoi.lng, type: pendingPoiType, label: pendingPoiLabel }])
                setPendingPoi(null)
              }} className="flex-1 bg-purple-600 text-white text-xs py-1.5 rounded-lg font-medium hover:bg-purple-700">
                Ajouter
              </button>
              <button onClick={() => setPendingPoi(null)} className="px-3 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gradient legend */}
      {route && <GradientLegend className="mb-4" />}

      {/* Edit mode: manual route or waypoint list */}
      {editMode && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-4 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-300 mb-2">Mode édition — clique sur la carte pour ajouter des points</p>
          <div className="flex flex-wrap gap-2">
            {waypoints.map((wp, i) => (
              <span key={i} className="flex items-center gap-1 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-full px-3 py-1 text-xs text-gray-700 dark:text-slate-300">
                {i === 0 ? '🟢' : i === waypoints.length - 1 ? '🔴' : `📍`} {wp[0].toFixed(4)}, {wp[1].toFixed(4)}
                <button onClick={() => removeWaypoint(i)} className="ml-1 text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
              </span>
            ))}
            {waypoints.length === 0 && <span className="text-amber-700 dark:text-amber-400">Clique sur la carte pour placer ton point de départ</span>}
          </div>
          {waypoints.length >= 2 && (
            <button onClick={handleManualRoute} disabled={recalcLoading}
              className="mt-3 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {recalcLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              Calculer cet itinéraire
            </button>
          )}
        </div>
      )}

      {route && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Distance', value: `${route.distanceKm.toFixed(1)} km` },
              { label: 'Dénivelé +', value: `${route.elevationGainM.toFixed(0)} m` },
              { label: 'Dénivelé -', value: `${route.elevationLossM.toFixed(0)} m` },
              { label: 'Durée estimée', value: `${Math.floor(route.durationEstMin / 60)}h${String(route.durationEstMin % 60).padStart(2, '0')}` },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Elevation profile */}
          {route.elevProfile.length > 1 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5">
              <h2 className="font-semibold mb-3 text-gray-700 dark:text-slate-200">Profil altimétrique</h2>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={route.elevProfile}>
                  <defs>
                    <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dist" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={v => `${v}km`} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number) => [`${v} m`, 'Altitude']} labelFormatter={l => `${l} km`} />
                  <Area type="monotone" dataKey="alt" stroke="#f97316" fill="url(#gPlan)" strokeWidth={2} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Statistiques de col */}
          {route.elevProfile.length > 1 && <ColStats elevProfile={route.elevProfile} />}

          {/* Météo prévue */}
          {plannedAt && route.coords.length > 0 && (
            <WeatherForecast
              lat={route.coords[0][0]}
              lng={route.coords[0][1]}
              plannedAt={new Date(plannedAt).toISOString()}
            />
          )}

          {/* AI advice */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <Brain size={18} className="text-purple-600 dark:text-purple-400" />
                Plan de sortie IA
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                  {DIFFICULTIES.find(d => d.value === difficulty)?.label}
                </span>
              </div>
              {!aiAdvice && (
                <button onClick={handleAiPlan} disabled={loadingAi}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {loadingAi && <Loader2 size={14} className="animate-spin" />}
                  {loadingAi ? 'Génération...' : 'Générer le plan'}
                </button>
              )}
              {aiAdvice && (
                <button onClick={handleAiPlan} disabled={loadingAi}
                  className="text-xs text-purple-500 dark:text-purple-400 hover:underline disabled:opacity-50">
                  {loadingAi ? <Loader2 size={12} className="animate-spin inline" /> : 'Regénérer'}
                </button>
              )}
            </div>
            {aiAdvice ? (
              <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 dark:prose-headings:text-white dark:prose-strong:text-white">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAdvice}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500">
                Génère un plan structuré par étapes avec objectifs de puissance/FC, ravitaillements aux bons kilomètres, et conseils nutrition.
              </p>
            )}
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving || !!savedId}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Sauvegarde...' : savedId ? '✓ Planification sauvegardée' : 'Sauvegarder la planification'}
            </button>
            {savedId && (
              <a href="/plans" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Voir mes planifications →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Manual mode — show map even with no route */}
      {!route && editMode && waypoints.length === 0 && (
        <p className="text-center text-sm text-gray-400 dark:text-slate-500 mt-4">
          Clique sur la carte pour poser tes waypoints, puis calcule l'itinéraire.
        </p>
      )}
    </div>
  )
}
