import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/axios'
import { Ride } from '@/lib/types'
import { formatDuration, formatDate } from '@/lib/utils'
import { UserPlus, Trophy, Bike, Users } from 'lucide-react'

interface LeaderEntry { userId: string; pseudo: string; value: number }
interface SearchUser { id: string; pseudo: string }

function RideCard({ ride }: { ride: Ride }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm">
          {ride.userPseudo[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-sm">{ride.userPseudo}</p>
          <p className="text-xs text-gray-400">{formatDate(ride.startedAt)}</p>
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <div><p className="font-bold">{ride.distanceKm.toFixed(1)} km</p><p className="text-xs text-gray-400">Distance</p></div>
        <div><p className="font-bold">{formatDuration(ride.durationSec)}</p><p className="text-xs text-gray-400">Durée</p></div>
        <div><p className="font-bold">{ride.elevationGainM.toFixed(0)} m</p><p className="text-xs text-gray-400">Dénivelé</p></div>
        {ride.avgWatts && <div><p className="font-bold">{ride.avgWatts.toFixed(0)} W</p><p className="text-xs text-gray-400">Puissance</p></div>}
      </div>
      <Link to={`/rides/${ride.id}`} className="mt-3 inline-block text-xs text-blue-600 hover:underline">Voir le détail →</Link>
    </div>
  )
}

export default function SocialPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'feed' | 'leaderboard' | 'discover'>('feed')
  const [metric, setMetric] = useState<'distance' | 'elevation' | 'watts'>('distance')
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [search, setSearch] = useState('')

  const { data: feed = [], isLoading: feedLoading } = useQuery<Ride[]>({
    queryKey: ['feed'],
    queryFn: () => api.get('/social/feed?pageSize=20').then(r => r.data),
    enabled: tab === 'feed',
  })

  const { data: leaderboard = [], isLoading: lbLoading } = useQuery<LeaderEntry[]>({
    queryKey: ['leaderboard', metric, period],
    queryFn: () => api.get(`/social/leaderboard?metric=${metric}&period=${period}`).then(r => r.data),
    enabled: tab === 'leaderboard',
  })

  const { data: users = [] } = useQuery<SearchUser[]>({
    queryKey: ['users', search],
    queryFn: () => api.get(`/social/users?q=${search}`).then(r => r.data),
    enabled: tab === 'discover',
  })

  const { mutate: follow } = useMutation({
    mutationFn: (id: string) => api.post(`/social/follow/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const metricLabel = { distance: 'km', elevation: 'm dénivelé', watts: 'W moy.' }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Social</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {([
          { key: 'feed', label: 'Feed', icon: Bike },
          { key: 'leaderboard', label: 'Classement', icon: Trophy },
          { key: 'discover', label: 'Découvrir', icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {tab === 'feed' && (
        <div className="max-w-xl space-y-4">
          {feedLoading ? (
            <p className="text-gray-400">Chargement...</p>
          ) : feed.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Bike size={40} className="mx-auto mb-3 opacity-30" />
              <p>Votre feed est vide.</p>
              <p className="text-sm mt-1">Suivez d'autres membres dans l'onglet "Découvrir".</p>
            </div>
          ) : (
            feed.map(r => <RideCard key={r.id} ride={r} />)
          )}
        </div>
      )}

      {/* Classement */}
      {tab === 'leaderboard' && (
        <div className="max-w-xl">
          <div className="flex gap-3 mb-4">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={metric}
              onChange={e => setMetric(e.target.value as typeof metric)}
            >
              <option value="distance">Distance</option>
              <option value="elevation">Dénivelé</option>
              <option value="watts">Puissance</option>
            </select>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={period}
              onChange={e => setPeriod(e.target.value as typeof period)}
            >
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
            </select>
          </div>

          {lbLoading ? (
            <p className="text-gray-400">Chargement...</p>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {leaderboard.map((entry, i) => (
                <div key={entry.userId} className={`flex items-center gap-4 px-5 py-3 ${i !== leaderboard.length - 1 ? 'border-b' : ''}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' : 'text-gray-400'
                  }`}>
                    {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm">
                    {entry.pseudo[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium">{entry.pseudo}</span>
                  <span className="font-bold text-gray-700">{entry.value.toFixed(1)} {metricLabel[metric]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Découvrir */}
      {tab === 'discover' && (
        <div className="max-w-md">
          <input
            type="text"
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
            placeholder="Rechercher un membre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                  {u.pseudo[0]?.toUpperCase()}
                </div>
                <span className="flex-1 font-medium">{u.pseudo}</span>
                <button
                  onClick={() => follow(u.id)}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                >
                  <UserPlus size={14} />
                  Suivre
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
