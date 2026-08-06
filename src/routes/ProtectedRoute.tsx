import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

// Wraps a route so it requires login, and optionally restricts it to
// specific roles (e.g. Owner Dashboard and Kanban are hidden from
// Installer accounts).
export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()

  // Real-mode session restoration (checking for an existing Supabase
  // session on page load) is async — without this, a refresh would
  // redirect to /login before getCurrentUser() has a chance to resolve,
  // even when a valid session exists.
  if (isLoading) return <div className="p-6 text-sm text-xa-slate">Loading…</div>

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/project" replace />
  }

  return <>{children}</>
}
