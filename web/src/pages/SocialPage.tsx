import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/axios'
import { formatDuration, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { UserPlus, Trophy, Bike, Users, Send, Trash2 } from 'lucide-react'

// ---- Types ----
interface ReactionGroup { emoji: string; count: number; userReacted: boolean }
interface CommentDto { id: string; userId: string; userPseudo: string; text: string; createdAt: string }
interface SimplePoint { lat: number; lng: number }
interface FeedRide {
  id: string; userId: string; userPseudo: string
  startedAt: string; endedAt?: string
  distanceKm: number; durationSec: number
  elevationGainM: number; elevationLossM: number
  avgSpeedKmh: number; avgWatts?: number; caloriesBurned: number
  reactions: ReactionGroup[]
  commentCount: number
  topComments: CommentDto[]
  points: SimplePoint[]
}
interface StoryUser { userId: string; pseudo: string; lastRideAt: string }
interface LeaderEntry { userId: string; pseudo: string; value: number }
interface SearchUser { id: string; pseudo: string; isFollowing: boolean }

const EMOJIS = ['🔥', '👏', '💪', '⚡']

// ---- Mini SVG Map ----
function MiniMap({ points }: { points: SimplePoint[] }) {
  if (points.length < 2) return null
  const lats = points.map(p => p.lat)
  const lngs = points.map(p => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const W = 400, H = 130, pad = 12
  const sx = (lng: number) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - 2 * pad)
  const sy = (lat: number) => H - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (H - 2 * pad)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.lng).toFixed(1)} ${sy(p.lat).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-slate-100 dark:bg-slate-900/60" style={{ height: 110 }}>
      <path d={d} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Start dot */}
      <circle cx={sx(points[0].lng)} cy={sy(points[0].lat)} r="4" fill="#22c55e" />
      {/* End dot */}
      <circle cx={sx(points[points.length - 1].lng)} cy={sy(points[points.length - 1].lat)} r="4" fill="#ef4444" />
    </svg>
  )
}

// ---- Stories bar ----
function StoriesBar({ stories }: { stories: StoryUser[] }) {
  if (stories.length === 0) return null
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 mb-5 scrollbar-hide">
      {stories.map(s => (
        <div key={s.userId} className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-cyan-400">
            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-lg">
              {s.pseudo[0]?.toUpperCase()}
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[56px] truncate text-center">{s.pseudo}</span>
        </div>
      ))}
    </div>
  )
}

// ---- Comment section ----
function CommentSection({ rideId, commentCount, topComments, currentUserId }: {
  rideId: string; commentCount: number; topComments: CommentDto[]; currentUserId?: string
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: allComments } = useQuery<CommentDto[]>({
    queryKey: ['comments', rideId],
    queryFn: () => api.get(`/social/comments/${rideId}`).then(r => r.data),
    enabled: expanded,
  })

  const { mutate: addComment, isPending } = useMutation({
    mutationFn: (t: string) => api.post(`/social/comments/${rideId}`, { text: t }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', rideId] }); qc.invalidateQueries({ queryKey: ['feed'] }); setText('') },
  })

  const { mutate: deleteComment } = useMutation({
    mutationFn: (id: string) => api.delete(`/social/comments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', rideId] }); qc.invalidateQueries({ queryKey: ['feed'] }) },
  })

  const displayed = expanded ? (allComments ?? topComments) : topComments
  const total = expanded ? (allComments?.length ?? commentCount) : commentCount

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
      {/* Top comments preview (collapsed) */}
      {!expanded && topComments.length > 0 && (
        <div className="space-y-1 mb-2">
          {topComments.map(c => (
            <p key={c.id} className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{c.userPseudo}</span> {c.text}
            </p>
          ))}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => { setExpanded(e => !e); setTimeout(() => inputRef.current?.focus(), 100) }}
        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        {expanded
          ? 'Réduire'
          : total > 0 ? `Voir ${total} commentaire${total > 1 ? 's' : ''}` : '+ Commenter'}
      </button>

      {/* Expanded: all comments + input */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {displayed.map(c => (
            <div key={c.id} className="flex items-start gap-2 group">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                {c.userPseudo[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm dark:text-slate-200">
                  <span className="font-semibold">{c.userPseudo}</span>{' '}
                  <span className="text-slate-600 dark:text-slate-300">{c.text}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(c.createdAt)}</p>
              </div>
              {c.userId === currentUserId && (
                <button
                  onClick={() => deleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}

          {/* Input */}
          <div className="flex gap-2 mt-2">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && text.trim()) addComment(text.trim()) }}
              placeholder="Écrire un commentaire..."
              className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-full px-3 py-1.5 bg-transparent dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={() => text.trim() && addComment(text.trim())}
              disabled={!text.trim() || isPending}
              className="text-blue-500 hover:text-blue-600 disabled:opacity-30 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Feed ride card ----
function RideCard({ ride, onReact, currentUserId }: {
  ride: FeedRide
  onReact: (rideId: string, emoji: string) => void
  currentUserId?: string
}) {
  return (
    <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-sm">
          {ride.userPseudo[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-sm dark:text-slate-100">{ride.userPseudo}</p>
          <p className="text-xs text-slate-400">{formatDate(ride.startedAt)}</p>
        </div>
      </div>

      {/* Mini map */}
      {ride.points.length > 1 && (
        <div className="mb-3">
          <MiniMap points={ride.points} />
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 text-sm mb-3">
        <div><p className="font-bold dark:text-slate-100">{ride.distanceKm.toFixed(1)} km</p><p className="text-xs text-slate-400">Distance</p></div>
        <div><p className="font-bold dark:text-slate-100">{formatDuration(ride.durationSec)}</p><p className="text-xs text-slate-400">Durée</p></div>
        <div><p className="font-bold dark:text-slate-100">{ride.elevationGainM.toFixed(0)} m</p><p className="text-xs text-slate-400">Dénivelé</p></div>
        {ride.avgWatts != null && (
          <div><p className="font-bold dark:text-slate-100">{ride.avgWatts.toFixed(0)} W</p><p className="text-xs text-slate-400">Puissance</p></div>
        )}
      </div>

      {/* Reactions */}
      <div className="flex items-center gap-2 mb-2">
        {EMOJIS.map(emoji => {
          const group = ride.reactions.find(r => r.emoji === emoji)
          const count = group?.count ?? 0
          const reacted = group?.userReacted ?? false
          return (
            <button
              key={emoji}
              onClick={() => onReact(ride.id, emoji)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm transition-all ${
                reacted
                  ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-300 dark:ring-blue-700'
                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{count}</span>}
            </button>
          )
        })}
        <Link to={`/rides/${ride.id}`} className="ml-auto text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1">
          Voir →
        </Link>
      </div>

      {/* Comments */}
      <CommentSection
        rideId={ride.id}
        commentCount={ride.commentCount}
        topComments={ride.topComments}
        currentUserId={currentUserId}
      />
    </div>
  )
}

// ---- Main page ----
export default function SocialPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'feed' | 'leaderboard' | 'discover'>('feed')
  const [metric, setMetric] = useState<'distance' | 'elevation' | 'watts'>('distance')
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [search, setSearch] = useState('')

  const currentUserId = useAuthStore(s => s.user?.id)

  const { data: feed = [], isLoading: feedLoading } = useQuery<FeedRide[]>({
    queryKey: ['feed'],
    queryFn: () => api.get('/social/feed?pageSize=20').then(r => r.data),
    enabled: tab === 'feed',
  })

  const { data: stories = [] } = useQuery<StoryUser[]>({
    queryKey: ['stories'],
    queryFn: () => api.get('/social/stories').then(r => r.data),
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

  const { mutate: react } = useMutation({
    mutationFn: ({ rideId, emoji }: { rideId: string; emoji: string }) =>
      api.post(`/social/reactions/${rideId}`, { emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  })

  const { mutate: follow } = useMutation({
    mutationFn: (id: string) => api.post(`/social/follow/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const { mutate: unfollow } = useMutation({
    mutationFn: (id: string) => api.delete(`/social/follow/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const metricLabel = { distance: 'km', elevation: 'm dénivelé', watts: 'W moy.' }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 dark:text-slate-100">Social</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit mb-6">
        {([
          { key: 'feed', label: 'Feed', icon: Bike },
          { key: 'leaderboard', label: 'Classement', icon: Trophy },
          { key: 'discover', label: 'Découvrir', icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-slate-100'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {tab === 'feed' && (
        <div className="max-w-xl">
          <StoriesBar stories={stories} />
          {feedLoading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : feed.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bike size={40} className="mx-auto mb-3 opacity-30" />
              <p>Votre feed est vide.</p>
              <p className="text-sm mt-1">Suivez d'autres membres dans l'onglet "Découvrir".</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feed.map(r => (
                <RideCard
                  key={r.id}
                  ride={r}
                  onReact={(rideId, emoji) => react({ rideId, emoji })}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Classement */}
      {tab === 'leaderboard' && (
        <div className="max-w-xl">
          <div className="flex gap-3 mb-4">
            <select
              className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              value={metric}
              onChange={e => setMetric(e.target.value as typeof metric)}
            >
              <option value="distance">Distance</option>
              <option value="elevation">Dénivelé</option>
              <option value="watts">Puissance</option>
            </select>
            <select
              className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              value={period}
              onChange={e => setPeriod(e.target.value as typeof period)}
            >
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
            </select>
          </div>

          {lbLoading ? (
            <p className="text-slate-400">Chargement...</p>
          ) : (
            <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border shadow-sm overflow-hidden">
              {leaderboard.map((entry, i) => (
                <div key={entry.userId} className={`flex items-center gap-4 px-5 py-3 ${i !== leaderboard.length - 1 ? 'border-b dark:border-slate-700' : ''}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' : 'text-gray-400'
                  }`}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-sm">
                    {entry.pseudo[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium dark:text-slate-100">{entry.pseudo}</span>
                  <span className="font-bold text-gray-700 dark:text-slate-300">{entry.value.toFixed(1)} {metricLabel[metric]}</span>
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
            className="w-full border rounded-lg px-3 py-2 text-sm mb-4 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400"
            placeholder="Rechercher un membre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl border shadow-sm px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400">
                  {u.pseudo[0]?.toUpperCase()}
                </div>
                <span className="flex-1 font-medium dark:text-slate-100">{u.pseudo}</span>
                {u.isFollowing ? (
                  <button
                    onClick={() => unfollow(u.id)}
                    className="flex items-center gap-1.5 text-sm border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                  >
                    <UserPlus size={14} />
                    Suivi
                  </button>
                ) : (
                  <button
                    onClick={() => follow(u.id)}
                    className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                  >
                    <UserPlus size={14} />
                    Suivre
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
