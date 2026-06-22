import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '@/lib/axios'
import { Bike } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', pseudo: '', password: '', heightCm: '', weightKg: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', {
        email: form.email,
        pseudo: form.pseudo,
        password: form.password,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
      })
      navigate('/login')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 409 ? 'Cet email est déjà utilisé.' : 'Erreur lors de l\'inscription.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <Bike className="text-blue-600" size={28} />
          <span className="font-bold text-xl">CycloTrack</span>
        </div>
        <h1 className="text-2xl font-bold mb-6">Créer un compte</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Email', field: 'email', type: 'email' },
            { label: 'Pseudo', field: 'pseudo', type: 'text' },
            { label: 'Mot de passe', field: 'password', type: 'password' },
            { label: 'Taille (cm)', field: 'heightCm', type: 'number' },
            { label: 'Poids (kg)', field: 'weightKg', type: 'number' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type={type} value={form[field as keyof typeof form]}
                onChange={e => set(field, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={field !== 'heightCm' && field !== 'weightKg'}
              />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Inscription...' : "S'inscrire"}
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-500">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
