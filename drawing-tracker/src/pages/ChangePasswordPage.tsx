import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { changePassword } from '@/services/authService'
import { useAuth } from '@/context/AuthContext'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password === '0000') {
      setError('Choose a password other than the default.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await changePassword(password)
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-ink px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop">
        <div className="mb-4 flex items-center gap-2 text-brand-ink">
          <KeyRound size={18} />
          <h1 className="font-semibold">Set a new password</h1>
        </div>
        <p className="mb-4 text-sm text-brand-slate">
          You're signed in with the default password. Set a new one before continuing.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-ink py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Change password
          </button>
        </form>
      </div>
    </div>
  )
}
