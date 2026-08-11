import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { fetchMyProfile, signOut as doSignOut } from '@/services/authService'
import type { Profile } from '@/types'

interface AuthContextValue {
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string | undefined) {
    if (!userId) {
      setProfile(null)
      return
    }
    try {
      const p = await fetchMyProfile(userId)
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session?.user?.id).finally(() => setLoading(false))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user?.id)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function refreshProfile() {
    const { data } = await supabase!.auth.getSession()
    await loadProfile(data.session?.user?.id)
  }

  async function signOut() {
    await doSignOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
