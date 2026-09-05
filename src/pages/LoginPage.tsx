import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { requestPasswordReset } from '../services/authService'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Enter your email and password to continue.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/projects')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetRequest(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email) {
      setError('Enter your account email to continue.')
      return
    }
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setResetSent(true)
    } catch {
      // Same confirmation either way — never reveal whether an email
      // address exists in the system.
      setResetSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'reset') {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-xa-blue">XA-DOS</p>
          <h1 className="mt-1 text-2xl font-extrabold text-xa-navy">Reset password</h1>
          <p className="mt-1 text-sm text-xa-slate">
            {resetSent
              ? "If that email is registered, we've sent a reset link to it."
              : "Enter your account email and we'll send you a reset link."}
          </p>
        </div>

        {!resetSent && (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-xa-slate">Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-xa-line bg-white px-3 py-3 focus-within:border-xa-blue">
                <Mail size={18} className="text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@xados.com"
                  className="w-full text-sm outline-none"
                  autoComplete="email"
                />
              </div>
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setMode('login')
            setResetSent(false)
            setError('')
          }}
          className="mt-4 w-full text-center text-sm font-semibold text-xa-blue"
        >
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-xa-blue">XA-DOS</p>
        <h1 className="mt-1 text-2xl font-extrabold text-xa-navy">Sign in</h1>
        <p className="mt-1 text-sm text-xa-slate">Field Monitoring</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-xa-slate">Email</label>
          <div className="flex items-center gap-2 rounded-xl border border-xa-line bg-white px-3 py-3 focus-within:border-xa-blue">
            <Mail size={18} className="text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@xados.com"
              className="w-full text-sm outline-none"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-xa-slate">Password</label>
          <div className="flex items-center gap-2 rounded-xl border border-xa-line bg-white px-3 py-3 focus-within:border-xa-blue">
            <Lock size={18} className="text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-sm outline-none"
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Log In'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('reset')
            setError('')
          }}
          className="w-full text-center text-sm font-semibold text-xa-blue"
        >
          Forgot password?
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-slate-400">
        Sign in with your XA DOS account.
      </p>
    </div>
  )
}
