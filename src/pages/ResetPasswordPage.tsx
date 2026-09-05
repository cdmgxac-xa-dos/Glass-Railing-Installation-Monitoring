import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { completePasswordReset } from '../services/authService'

// Public route (not behind ProtectedRoute) — reached only by following the
// link from a password-reset email, which establishes a temporary Supabase
// recovery session via the URL fragment before this page even mounts.
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase!.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('This reset link is invalid or has expired. Request a new one from the login screen.')
      }
      setReady(true)
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await completePasswordReset(newPassword)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12 text-center">
        <h1 className="text-xl font-extrabold text-xa-navy">Password updated</h1>
        <p className="mt-2 text-sm text-xa-slate">Sign in with your new password to continue.</p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="mt-6 w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98]"
        >
          Back to Sign In
        </button>
      </div>
    )
  }

  if (!ready) {
    return <div className="p-6 text-sm text-xa-slate">Loading…</div>
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-xa-blue">XA-DOS</p>
        <h1 className="mt-1 text-2xl font-extrabold text-xa-navy">Set a new password</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-xa-slate">New Password</label>
          <div className="flex items-center gap-2 rounded-xl border border-xa-line bg-white px-3 py-3 focus-within:border-xa-blue">
            <Lock size={18} className="text-slate-400" />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full text-sm outline-none"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-xa-slate">Confirm Password</label>
          <div className="flex items-center gap-2 rounded-xl border border-xa-line bg-white px-3 py-3 focus-within:border-xa-blue">
            <Lock size={18} className="text-slate-400" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full text-sm outline-none"
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Set Password'}
        </button>
      </form>
    </div>
  )
}
