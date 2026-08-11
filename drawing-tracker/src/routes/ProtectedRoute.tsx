import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { AppRole } from '@/types'

export function ProtectedRoute({ allow }: { allow?: AppRole[] }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-brand-slate">
        Loading…
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />

  if (profile.must_change_password) return <Navigate to="/change-password" replace />

  if (allow && !allow.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
