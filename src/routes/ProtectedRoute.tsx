import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  // Real-mode-only escape hatch for granting access by the underlying DB
  // role_code instead of the collapsed UserRole — needed when a route
  // should open for one specific role_code (e.g. field_pic) without also
  // opening it for every other role_code that collapses onto the same
  // UserRole ('QC Inspector' covers qc_officer/field_pic/safety_officer,
  // see authService.ts's ROLE_CODE_MAP). Undefined/no roleCode in mock
  // mode simply never matches, same as the pin-manager check in
  // FloorPlanPage.tsx.
  allowedRoleCodes?: string[]
}

// Wraps a route so it requires login, and optionally restricts it to
// specific roles (e.g. Owner Dashboard and Kanban are hidden from
// Installer accounts). A route passing both allowedRoles and
// allowedRoleCodes opens for either match.
export default function ProtectedRoute({ children, allowedRoles, allowedRoleCodes }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // Real-mode session restoration (checking for an existing Supabase
  // session on page load) is async — without this, a refresh would
  // redirect to /login before getCurrentUser() has a chance to resolve,
  // even when a valid session exists.
  if (isLoading) return <div className="p-6 text-sm text-xa-slate">Loading…</div>

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // New accounts created with an admin-set temporary password must set
  // their own before touching anything else in the app.
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (allowedRoles && user) {
    const roleMatches = allowedRoles.includes(user.role)
    const roleCodeMatches = allowedRoleCodes && user.roleCode ? allowedRoleCodes.includes(user.roleCode) : false
    if (!roleMatches && !roleCodeMatches) {
      return <Navigate to="/project" replace />
    }
  }

  return <>{children}</>
}
