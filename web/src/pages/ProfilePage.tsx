import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { User, Save } from 'lucide-react'

const GOALS = [
  { value: 'endurance', label: '🚴 Endurance', desc: 'Développer ma base aérobie et ma résistance' },
  { value: 'performance', label: '⚡ Performance', desc: 'Améliorer ma puissance et mes temps' },
  { value: 'weight_loss', label: '⚖️ Perte de poids', desc: 'Brûler des graisses en préservant le muscle' },
]

export default function ProfilePage() {
  const user = useAuthStore(s => s.user)
  const setAuth = useAuthStore(s => s.setAuth)
  const [form, setForm] = useState({
    pseudo: user?.pseudo ?? '',
    heightCm: user?.heightCm ? String(user.heightCm) : '',
    weightKg: user?.weightKg ? String(user.weightKg) : '',
    ftp: user?.ftp ? String(user.ftp) : '',
    maxHrBpm: user?.maxHrBpm ? String(user.maxHrBpm) : '',
    goal: user?.goal ?? '',
  })
  const [saved, setSaved] = useState(false)
  const [spotifyLinked, setSpotifyLinked] = useState(false)
  const [spotifyLoading, setSpotifyLoading] = useState(false)

  useEffect(() => {
    api.get('/spotify/status').then(r => setSpotifyLinked(r.data.linked)).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('spotify') === 'linked') {
      setSpotifyLinked(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.put('/auth/me', {
      pseudo: form.pseudo || null,
      heightCm: form.heightCm ? Number(form.heightCm) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
      ftp: form.ftp ? Number(form.ftp) : null,
      maxHrBpm: form.maxHrBpm ? Number(form.maxHrBpm) : null,
      goal: form.goal || null,
    }),
    onSuccess: ({ data }) => {
      setAuth(data, useAuthStore.getState().accessToken ?? '')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  async function handleSpotifyConnect() {
    setSpotifyLoading(true)
    try {
      const res = await api.get('/spotify/auth-url')
      window.location.href = res.data.url
    } finally {
      setSpotifyLoading(false)
    }
  }

  async function handleSpotifyUnlink() {
    await api.delete('/spotify/unlink')
    setSpotifyLinked(false)
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-slate-400">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
      />
    </div>
  )

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Profil</h1>

      {/* Identité */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <User size={28} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900 dark:text-white">{user?.pseudo}</p>
            <p className="text-gray-400 dark:text-slate-500 text-sm">{user?.email}</p>
          </div>
        </div>
        <div className="space-y-4">
          {field('Pseudo', 'pseudo')}
          <div className="grid grid-cols-2 gap-3">
            {field('Taille (cm)', 'heightCm', 'number', '175')}
            {field('Poids (kg)', 'weightKg', 'number', '70')}
          </div>
        </div>
      </div>

      {/* Profil fitness */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-6 mb-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Profil fitness</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Ces données permettent à l'IA de personnaliser ses conseils nutrition et entraînement.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field('FTP (W)', 'ftp', 'number', 'ex: 220')}
            {field('FC max (bpm)', 'maxHrBpm', 'number', 'ex: 185')}
          </div>

          {/* Objectif */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-slate-400">Objectif principal</label>
            <div className="space-y-2">
              {GOALS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, goal: f.goal === g.value ? '' : g.value }))}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    form.goal === g.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                      : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                  }`}
                >
                  <span className="font-medium text-gray-900 dark:text-white">{g.label}</span>
                  <span className="block text-xs text-gray-400 dark:text-slate-500 mt-0.5">{g.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
            <p className="font-semibold mb-1">💡 Comment trouver son FTP ?</p>
            <p>Test de 20 min à fond × 0,95. Ou utilisez 95% de votre meilleure puissance moyenne sur 20 min.</p>
          </div>
        </div>
      </div>

      {/* Bouton sauvegarder — sticky en bas */}
      <div className="sticky bottom-4 z-10 mb-5">
        <button
          onClick={() => save()}
          disabled={isPending}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium w-full justify-center shadow-lg transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
          }`}
        >
          <Save size={15} />
          {saved ? 'Sauvegardé ✓' : isPending ? 'Sauvegarde...' : 'Sauvegarder le profil'}
        </button>
      </div>

      {/* Spotify */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center text-xl">🎵</div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Spotify</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {spotifyLinked ? 'Compte connecté — suivi musical actif' : 'Suivez votre musique pendant les sorties'}
            </p>
          </div>
          {spotifyLinked && (
            <span className="ml-auto text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-medium">Connecté</span>
          )}
        </div>
        {spotifyLinked ? (
          <button onClick={handleSpotifyUnlink} className="w-full border dark:border-slate-600 text-gray-600 dark:text-slate-400 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700">
            Déconnecter Spotify
          </button>
        ) : (
          <button onClick={handleSpotifyConnect} disabled={spotifyLoading} className="w-full bg-[#1db954] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1aa34a] disabled:opacity-50">
            {spotifyLoading ? 'Redirection...' : 'Connecter mon compte Spotify'}
          </button>
        )}
      </div>
    </div>
  )
}
