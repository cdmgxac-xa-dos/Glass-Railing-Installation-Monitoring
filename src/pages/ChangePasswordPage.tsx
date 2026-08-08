import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Shown instead of every other route when the signed-in account still has
// its admin-set temporary password (see ProtectedRoute). Once submitted,
// AuthContext.changePassword clears mustChangePassword and normal
// navigation resumes.
export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { changePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      await changePassword(newPassword)
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-xa-blue">XA DOS</p>
        <h1 className="mt-1 text-2xl font-extrabold text-xa-navy">Set a new password</h1>
        <p className="mt-1 text-sm text-xa-slate">
          For your security, set your own password before continuing.
        </p>
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
          {loading ? 'Saving…' : 'Set Password & Continue'}
        </button>
      </form>
    </div>
  )
}
