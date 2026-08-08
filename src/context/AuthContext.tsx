import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppUser, UserRole } from '../types'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import {
  getCurrentUser,
  getUserForRole,
  login as loginService,
  logout as logoutService,
  changePassword as changePasswordService,
} from '../services/authService'

interface AuthContextValue {
  user: AppUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  switchRole: (role: UserRole) => void
  changePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  // Starts true in real mode so routes don't briefly flash "logged out"
  // before session restoration has had a chance to run.
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    getCurrentUser()
      .then((restored) => {
        if (!cancelled) setUser(restored)
      })
      .catch((err) => {
        console.error('Failed to restore session:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    // Keep in sync with token refreshes and sign-outs that happen outside
    // this component (e.g. an expired refresh token, or signOut() called
    // elsewhere).
    const { data: subscription } = supabase!.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login: async (email, password) => {
        const loggedInUser = await loginService(email, password)
        setUser(loggedInUser)
      },
      logout: () => {
        logoutService().catch((err) => console.error('Logout failed:', err))
        setUser(null)
      },
      switchRole: (role) => setUser(getUserForRole(role)),
      changePassword: async (newPassword) => {
        await changePasswordService(newPassword)
        setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev))
      },
    }),
    [user, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
