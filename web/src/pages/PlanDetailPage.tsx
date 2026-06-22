import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '@/lib/axios'
import { computeRoute, decodePolyline, RouteData, elevationsFromProfile } from '@/lib/routing'
import GradientPolyline, { GradientLegend } from '@/components/GradientPolyline'
import { Loader2, ArrowLeft, CheckCircle2, Calendar, Brain, Pencil, Copy, X, Check, MapPin, Trash2, Edit2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })
const markerIcon = new L.Icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] })

interface PlanDetail {
  id: string
  title: string
  plannedAt: string | null
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  estimatedDurationMin: number
  isCompleted: boolean
  createdAt: string
  routePolyline: string | null
  aiAdvice: string | null
  googleMapsUrl: string | null
  elevationJson: string | null
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function MapClickHandler({ active, onMapClick }: { active: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { if (active) onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Map editor state (inside edit mode)
  const [mapEditMode, setMapEditMode] = useState(false)
  const [waypoints, setWaypoints] = useState<[number, number][]>([])
  const [newRoute, setNewRoute] = useState<RouteData | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => {
    api.get(`/plan/${id}`).then(r => setPlan(r.data)).finally(() => setLoading(false))
  }, [id])

  async function markComplete() {
    await api.patch(`/plan/${id}/complete`)
    setPlan(p => p ? { ...p, isCompleted: true } : p)
  }

  function startEdit() {
    if (!plan) return
    setEditTitle(plan.title)
    setEditDate(toDatetimeLocal(plan.plannedAt))
    setNewRoute(null)
    setWaypoints([])
    setMapEditMode(false)
    setRouteError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setMapEditMode(false)
    setWaypoints([])
    setNewRoute(null)
    setRouteError(null)
  }

  function toggleMapEdit() {
    if (!mapEditMode) {
      // Pre-seed start/end from current polyline
      const poly = newRoute ? null : plan?.routePolyline
      if (poly) {
        const decoded = decodePolyline(poly)
        if (decoded.length >= 2) setWaypoints([decoded[0], decoded[decoded.length - 1]])
        else setWaypoints([])
      }
      setNewRoute(null)
      setRouteError(null)
    } else {
      setWaypoints([])
      setNewRoute(null)
    }
    setMapEditMode(m => !m)
  }

  async function calcNewRoute() {
    if (waypoints.length < 2) return
    setRouteError(null)
    setRouteLoading(true)
    try {
      const r = await computeRoute(waypoints)
      setNewRoute(r)
      setMapEditMode(false)
    } catch (e: any) {
      setRouteError(e.message ?? 'Erreur de calcul')
    } finally {
      setRouteLoading(false)
    }
  }

  async function saveEdit() {
    if (!plan) return
    setSaving(true)
    try {
      const body: Record<string, any> = {
        title: editTitle.trim() || plan.title,
        plannedAt: editDate ? new Date(editDate).toISOString() : null,
      }
      if (newRoute) {
        body.routePolyline = newRoute.encodedPolyline
        body.distanceKm = newRoute.distanceKm
        body.elevationGainM = newRoute.elevationGainM
        body.elevationLossM = newRoute.elevationLossM
        body.estimatedDurationMin = newRoute.durationEstMin
      }
      const res = await api.patch(`/plan/${id}`, body)
      setPlan(res.data)
      setEditing(false)
      setNewRoute(null)
      setWaypoints([])
      setMapEditMode(false)
    } finally {
      setSaving(false)
    }
  }

  async function duplicate() {
    setDuplicating(true)
    try {
      const res = await api.post(`/plan/${id}/duplicate`)
      navigate(`/plans/${res.data.id}`)
    } finally {
      setDuplicating(false)
    }
  }

  if (loading) return <div className="p-8 flex items-center gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" /></div>
  if (!plan) return <div className="p-8 text-gray-400">Planification introuvable.</div>

  const displayPolyline = newRoute ? newRoute.encodedPolyline : plan.routePolyline
  const coords = displayPolyline ? decodePolyline(displayPolyline) : []
  const center: [number, number] = waypoints.length > 0 ? waypoints[0]
    : coords.length ? coords[Math.floor(coords.length / 2)]
    : [46.5, 2.5]

  // Elevations for gradient coloring
  const displayElevations = useMemo(() => {
    if (newRoute) return newRoute.elevations
    if (!coords.length || !plan.elevationJson) return []
    try {
      const profile: { dist: number; alt: number }[] = JSON.parse(plan.elevationJson)
      return elevationsFromProfile(coords, profile)
    } catch { return [] }
  }, [coords, newRoute, plan.elevationJson])

  const displayStats = newRoute
    ? { distanceKm: newRoute.distanceKm, elevationGainM: newRoute.elevationGainM, elevationLossM: newRoute.elevationLossM, estimatedDurationMin: newRoute.durationEstMin }
    : plan

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => navigate('/plans')} className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white mb-4">
        <ArrowLeft size={14} /> Retour
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 mr-4">
          {editing ? (
            <div className="space-y-2">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full text-2xl font-bold bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg px-3 py-1 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="datetime-local"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
                className="text-sm bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg px-3 py-1 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {plan.isCompleted && <CheckCircle2 size={20} className="text-green-500" />}
                {plan.title}
              </h1>
              {plan.plannedAt && (
                <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-1">
                  <Calendar size={13} />
                  {new Date(plan.plannedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700">
                <X size={14} /> Annuler
              </button>
              <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enregistrer
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border dark:border-slate-700">
                <Pencil size={13} /> Modifier
              </button>
              {plan.isCompleted && (
                <button onClick={duplicate} disabled={duplicating} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border dark:border-slate-700 disabled:opacity-50">
                  {duplicating ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                  Dupliquer
                </button>
              )}
              {!plan.isCompleted && (
                <button onClick={markComplete} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  <CheckCircle2 size={14} />
                  Marquer comme effectuée
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Distance', value: `${displayStats.distanceKm.toFixed(1)} km` },
          { label: 'Dénivelé +', value: `${displayStats.elevationGainM.toFixed(0)} m` },
          { label: 'Dénivelé -', value: `${displayStats.elevationLossM.toFixed(0)} m` },
          { label: 'Durée estimée', value: `${Math.floor(displayStats.estimatedDurationMin / 60)}h${String(displayStats.estimatedDurationMin % 60).padStart(2, '0')}` },
        ].map(s => (
          <div key={s.label} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 text-center ${newRoute ? 'border-blue-300 dark:border-blue-600' : 'dark:border-slate-700'}`}>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Map */}
      {(coords.length > 0 || editing) && (
        <div className="mb-6">
          <div className="rounded-xl overflow-hidden border dark:border-slate-700 h-72 relative">
            <MapContainer center={center} zoom={coords.length ? 13 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler active={mapEditMode} onMapClick={(lat, lng) => setWaypoints(p => [...p, [lat, lng]])} />
              {coords.length > 0 && displayElevations.length > 0 && (
                <GradientPolyline coords={coords} elevations={displayElevations} />
              )}
              {coords.length > 0 && displayElevations.length === 0 && (
                <GradientPolyline coords={coords} elevations={new Array(coords.length).fill(0)} />
              )}
              {mapEditMode && waypoints.map((wp, i) => (
                <Marker key={i} position={wp} draggable icon={markerIcon}
                  eventHandlers={{ dragend: (e: any) => { const ll = e.target.getLatLng(); setWaypoints(p => p.map((w, idx) => idx === i ? [ll.lat, ll.lng] : w)) } }}
                />
              ))}
            </MapContainer>

            {/* Map toolbar — only in edit mode */}
            {editing && (
              <div className="absolute bottom-3 right-3 z-[1000] flex gap-2">
                <button
                  onClick={toggleMapEdit}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md ${mapEditMode ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-white border dark:border-slate-600'}`}
                >
                  <Edit2 size={11} />{mapEditMode ? 'Mode édition ON' : 'Modifier le tracé'}
                </button>
                {mapEditMode && waypoints.length >= 2 && (
                  <button onClick={calcNewRoute} disabled={routeLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md bg-blue-600 text-white disabled:opacity-50">
                    {routeLoading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Calculer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Gradient legend */}
          {coords.length > 0 && !mapEditMode && <GradientLegend className="mt-3" />}

          {/* Waypoint editor panel */}
          {editing && mapEditMode && (
            <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300 mb-2">Clique sur la carte pour placer des points, puis "Calculer"</p>
              {routeError && <p className="text-red-600 dark:text-red-400 text-xs mb-2">{routeError}</p>}
              <div className="flex flex-wrap gap-2">
                {waypoints.map((wp, i) => (
                  <span key={i} className="flex items-center gap-1 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-full px-3 py-1 text-xs text-gray-700 dark:text-slate-300">
                    {i === 0 ? '🟢' : i === waypoints.length - 1 ? '🔴' : '📍'} {wp[0].toFixed(4)}, {wp[1].toFixed(4)}
                    <button onClick={() => setWaypoints(p => p.filter((_, idx) => idx !== i))} className="ml-1 text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                  </span>
                ))}
                {waypoints.length === 0 && <span className="text-amber-700 dark:text-amber-400">Clique sur la carte pour poser le départ</span>}
              </div>
              {waypoints.length >= 2 && (
                <button onClick={calcNewRoute} disabled={routeLoading} className="mt-3 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {routeLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                  {routeLoading ? 'Calcul en cours...' : 'Calculer cet itinéraire'}
                </button>
              )}
            </div>
          )}

          {newRoute && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-2">
              <Check size={14} /> Nouveau tracé calculé — sera sauvegardé avec les modifications
              <button onClick={() => { setNewRoute(null); setWaypoints([]) }} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={13} /></button>
            </div>
          )}
        </div>
      )}

      {/* AI advice */}
      {plan.aiAdvice && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-5">
          <h2 className="font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <Brain size={16} className="text-purple-500" /> Conseils du coach IA
          </h2>
          <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 dark:prose-headings:text-white dark:prose-strong:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.aiAdvice}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
