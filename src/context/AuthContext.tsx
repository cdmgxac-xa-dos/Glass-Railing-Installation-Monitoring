import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AppUser, UserRole } from '../types'
import { getUserForRole, mockLogin } from '../services/authService'

interface AuthContextValue {
  user: AppUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  switchRole: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      login: async (email, password) => {
        const loggedInUser = await mockLogin(email, password)
        setUser(loggedInUser)
      },
      logout: () => setUser(null),
      switchRole: (role) => setUser(getUserForRole(role)),
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
