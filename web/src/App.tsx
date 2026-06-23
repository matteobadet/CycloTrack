import { Routes, Route, Navigate, Suspense, lazy } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'

const DashboardPage  = lazy(() => import('@/pages/DashboardPage'))
const RidesPage      = lazy(() => import('@/pages/RidesPage'))
const RideDetailPage = lazy(() => import('@/pages/RideDetailPage'))
const GoalsPage      = lazy(() => import('@/pages/GoalsPage'))
const SocialPage     = lazy(() => import('@/pages/SocialPage'))
const ProfilePage    = lazy(() => import('@/pages/ProfilePage'))
const PlanPage       = lazy(() => import('@/pages/PlanPage'))
const PlansListPage  = lazy(() => import('@/pages/PlansListPage'))
const PlanDetailPage = lazy(() => import('@/pages/PlanDetailPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
        <Route path="rides" element={<Suspense fallback={<PageLoader />}><RidesPage /></Suspense>} />
        <Route path="rides/:id" element={<Suspense fallback={<PageLoader />}><RideDetailPage /></Suspense>} />
        <Route path="goals" element={<Suspense fallback={<PageLoader />}><GoalsPage /></Suspense>} />
        <Route path="social" element={<Suspense fallback={<PageLoader />}><SocialPage /></Suspense>} />
        <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
        <Route path="plan" element={<Suspense fallback={<PageLoader />}><PlanPage /></Suspense>} />
        <Route path="plans" element={<Suspense fallback={<PageLoader />}><PlansListPage /></Suspense>} />
        <Route path="plans/:id" element={<Suspense fallback={<PageLoader />}><PlanDetailPage /></Suspense>} />
      </Route>
    </Routes>
  )
}
