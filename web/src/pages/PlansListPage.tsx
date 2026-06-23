import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/axios'
import { Loader2, MapPin, Plus, CheckCircle2, Trash2, Calendar, Clock } from 'lucide-react'

interface PlannedRide {
  id: string
  title: string
  plannedAt: string | null
  distanceKm: number
  elevationGainM: number
  estimatedDurationMin: number
  isCompleted: boolean
  createdAt: string
}

function DaysUntil({ date }: { date: string }) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (diff < 0) return <span className="text-xs text-gray-400 dark:text-slate-500">Passé</span>
  if (diff === 0) return <span className="text-xs font-semibold text-orange-500">Aujourd'hui !</span>
  if (diff === 1) return <span className="text-xs font-semibold text-orange-400">Demain</span>
  if (diff <= 7) return <span className="text-xs font-medium text-blue-500 dark:text-blue-400">Dans {diff} jours</span>
  return <span className="text-xs text-gray-400 dark:text-slate-500">Dans {diff} jours</span>
}

export default function PlansListPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlannedRide[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/plan')
      setPlans(res.data)
    } finally {
      setLoading(false)
    }
  }

  async function deletePlan(id: string) {
    await api.delete(`/plan/${id}`)
    setPlans(p => p.filter(x => x.id !== id))
  }

  async function markCompleted(id: string) {
    setCompleting(id)
    try {
      await api.patch(`/plan/${id}/complete`)
      setPlans(p => p.map(x => x.id === id ? { ...x, isCompleted: true } : x))
    } finally {
      setCompleting(null)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="p-8 flex items-center gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" /> Chargement...</div>

  const upcoming = plans.filter(p => !p.isCompleted)
  const done = plans.filter(p => p.isCompleted)

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mes planifications</h1>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Sorties planifiées — retrouvez-les sur mobile pour le suivi.</p>
        </div>
        <button
          onClick={() => navigate('/plan')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={15} />
          Nouvelle sortie
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">
          <MapPin size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune sortie planifiée</p>
          <button onClick={() => navigate('/plan')} className="mt-4 text-blue-600 dark:text-blue-400 text-sm">Planifier ma première sortie →</button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3">À venir ({upcoming.length})</h2>
              <div className="space-y-3">
                {upcoming.map(p => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/plans/${p.id}`)}
                    className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{p.title}</h3>
                          {p.plannedAt && <DaysUntil date={p.plannedAt} />}
                        </div>
                        {p.plannedAt && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1">
                            <Calendar size={11} />
                            {new Date(p.plannedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-slate-400">
                          <span>{p.distanceKm.toFixed(1)} km</span>
                          <span>↑ {p.elevationGainM.toFixed(0)} m</span>
                          <span>{Math.floor(p.estimatedDurationMin / 60)}h{String(p.estimatedDurationMin % 60).padStart(2, '0')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => markCompleted(p.id)}
                          disabled={completing === p.id}
                          title="Marquer comme effectuée"
                          className="p-2 text-gray-300 dark:text-slate-600 hover:text-green-500 dark:hover:text-green-400 transition-colors disabled:opacity-50"
                        >
                          {completing === p.id ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />}
                        </button>
                        <button
                          onClick={() => deletePlan(p.id)}
                          className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3">Effectuées ({done.length})</h2>
              <div className="space-y-2">
                {done.map(p => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/plans/${p.id}`)}
                    className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow opacity-60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate">{p.title}</span>
                      </div>
                      <div className="flex gap-3 text-sm text-gray-400 dark:text-slate-500 shrink-0">
                        <span>{p.distanceKm.toFixed(1)} km</span>
                        <span>↑ {p.elevationGainM.toFixed(0)} m</span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deletePlan(p.id) }}
                        className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
