import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { Goal } from '@/lib/types'
import { Target, Plus, Trash2, Trophy } from 'lucide-react'

const GOAL_TYPES = [
  { value: 'Distance', label: 'Distance (km)', unit: 'km' },
  { value: 'Elevation', label: 'Dénivelé (m)', unit: 'm' },
  { value: 'RideCount', label: 'Nombre de sorties', unit: 'sorties' },
  { value: 'Performance', label: 'Puissance moy. (W)', unit: 'W' },
]

const PERIODS = [
  { value: 'Week', label: 'Cette semaine' },
  { value: 'Month', label: 'Ce mois' },
  { value: 'Year', label: 'Cette année' },
]

function getPeriodDates(period: string) {
  const now = new Date()
  const start = new Date()
  const end = new Date()
  if (period === 'Week') {
    const day = now.getDay() || 7
    start.setDate(now.getDate() - day + 1)
    end.setDate(start.getDate() + 6)
  } else if (period === 'Month') {
    start.setDate(1)
    end.setMonth(now.getMonth() + 1, 0)
  } else {
    start.setMonth(0, 1)
    end.setMonth(11, 31)
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() }
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const typeInfo = GOAL_TYPES.find(t => t.value === goal.type)!
  const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100)
  const isAchieved = goal.isAchieved || goal.currentValue >= goal.targetValue

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 ${isAchieved ? 'border-green-200 bg-green-50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {isAchieved && <Trophy size={16} className="text-yellow-500" />}
            <p className="font-semibold text-gray-900">{typeInfo.label}</p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {PERIODS.find(p => p.value === goal.period)?.label}
            {goal.description && ` — ${goal.description}`}
          </p>
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Barre de progression */}
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-gray-700">
            {goal.currentValue.toFixed(goal.type === 'RideCount' ? 0 : 1)} {typeInfo.unit}
          </span>
          <span className="text-gray-400">
            / {goal.targetValue} {typeInfo.unit}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isAchieved ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-right text-gray-400">{progress.toFixed(0)}%</p>
    </div>
  )
}

export default function GoalsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'Distance', period: 'Month', targetValue: '', description: '' })

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then(r => r.data),
  })

  const { mutate: createGoal, isPending: creating } = useMutation({
    mutationFn: (data: object) => api.post('/goals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowForm(false); setForm({ type: 'Distance', period: 'Month', targetValue: '', description: '' }) },
  })

  const { mutate: deleteGoal } = useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })

  function handleCreate() {
    if (!form.targetValue) return
    const { startDate, endDate } = getPeriodDates(form.period)
    createGoal({
      type: form.type,
      period: form.period,
      targetValue: parseFloat(form.targetValue),
      description: form.description || null,
      startDate,
      endDate,
    })
  }

  const active = goals.filter(g => !g.isAchieved && g.currentValue < g.targetValue)
  const achieved = goals.filter(g => g.isAchieved || g.currentValue >= g.targetValue)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Objectifs</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          Nouvel objectif
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="bg-white rounded-xl border shadow-sm p-5 mb-6 space-y-4">
          <h2 className="font-semibold">Créer un objectif</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Type</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {GOAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Période</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.period}
                onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
              >
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">
                Cible ({GOAL_TYPES.find(t => t.value === form.type)?.unit})
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: 500"
                value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Description (optionnel)</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Objectif été"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating || !form.targetValue}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Création...' : 'Créer'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">
              Annuler
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target size={48} className="mx-auto mb-3 opacity-30" />
          <p>Aucun objectif défini.</p>
          <p className="text-sm mt-1">Créez votre premier objectif pour suivre votre progression.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">En cours</h2>
              <div className="grid grid-cols-2 gap-4">
                {active.map(g => <GoalCard key={g.id} goal={g} onDelete={() => deleteGoal(g.id)} />)}
              </div>
            </div>
          )}
          {achieved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Atteints 🏆</h2>
              <div className="grid grid-cols-2 gap-4">
                {achieved.map(g => <GoalCard key={g.id} goal={g} onDelete={() => deleteGoal(g.id)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
