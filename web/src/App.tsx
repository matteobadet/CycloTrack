import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import RidesPage from '@/pages/RidesPage'
import RideDetailPage from '@/pages/RideDetailPage'
import GoalsPage from '@/pages/GoalsPage'
import SocialPage from '@/pages/SocialPage'
import ProfilePage from '@/pages/ProfilePage'
import PlanPage from '@/pages/PlanPage'
import PlansListPage from '@/pages/PlansListPage'
import PlanDetailPage from '@/pages/PlanDetailPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="rides" element={<RidesPage />} />
        <Route path="rides/:id" element={<RideDetailPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="social" element={<SocialPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="plans" element={<PlansListPage />} />
        <Route path="plans/:id" element={<PlanDetailPage />} />
      </Route>
    </Routes>
  )
}
