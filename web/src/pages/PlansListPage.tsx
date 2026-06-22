import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/axios'
import { Loader2, MapPin, Plus, CheckCircle2, Trash2, Calendar } from 'lucide-react'

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

export default function PlansListPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlannedRide[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { load() }, [])

  if (loading) return <div className="p-8 flex items-center gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" /> Chargement...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
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
        <div className="space-y-3">
          {plans.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/plans/${p.id}`)}
              className={`bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow ${p.isCompleted ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {p.isCompleted && <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />}
                    <h3 className="font-semibold text-gray-900 dark:text-white">{p.title}</h3>
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
                <button
                  onClick={e => { e.stopPropagation(); deletePlan(p.id) }}
                  className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
