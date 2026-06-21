import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { User, Save } from 'lucide-react'

export default function ProfilePage() {
  const user = useAuthStore(s => s.user)
  const setAuth = useAuthStore(s => s.setAuth)
  const [form, setForm] = useState({
    pseudo: user?.pseudo ?? '',
    heightCm: user?.heightCm ? String(user.heightCm) : '',
    weightKg: user?.weightKg ? String(user.weightKg) : '',
  })
  const [saved, setSaved] = useState(false)

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.put('/auth/me', {
      pseudo: form.pseudo,
      heightCm: form.heightCm ? Number(form.heightCm) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
    }),
    onSuccess: ({ data }) => {
      setAuth(data, useAuthStore.getState().accessToken ?? '')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Profil</h1>

      <div className="bg-white rounded-xl border shadow-sm p-6 max-w-md">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <User size={28} className="text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-lg">{user?.pseudo}</p>
            <p className="text-gray-400 text-sm">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Pseudo', field: 'pseudo', type: 'text' },
            { label: 'Taille (cm)', field: 'heightCm', type: 'number' },
            { label: 'Poids (kg)', field: 'weightKg', type: 'number' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 text-gray-600">{label}</label>
              <input
                type={type}
                value={form[field as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          <button
            onClick={() => save()}
            disabled={isPending}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 w-full justify-center"
          >
            <Save size={15} />
            {saved ? 'Sauvegardé ✓' : isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md text-sm text-amber-700">
        <p className="font-semibold mb-1">Pourquoi renseigner taille et poids ?</p>
        <p>Ces données permettent d'affiner le calcul des calories brûlées et d'améliorer la pertinence des conseils du coach IA.</p>
      </div>
    </div>
  )
}
