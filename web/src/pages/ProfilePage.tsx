import { useAuthStore } from '@/stores/authStore'

export default function ProfilePage() {
  const user = useAuthStore(s => s.user)
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Profil</h1>
      <div className="bg-white rounded-xl border shadow-sm p-5 max-w-sm">
        <p className="font-semibold text-lg">{user?.pseudo}</p>
        <p className="text-gray-400 text-sm">{user?.email}</p>
      </div>
    </div>
  )
}
