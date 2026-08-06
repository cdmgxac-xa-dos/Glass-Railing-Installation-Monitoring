import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-xa-blue">XA DOS</p>
        <h1 className="mt-1 text-2xl font-extrabold text-xa-navy">Sign in</h1>
        <p className="mt-1 text-sm text-xa-slate">Glass Railing Installation Monitoring</p>
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

        <button type="button" className="w-full text-center text-sm font-semibold text-xa-blue">
          Forgot password?
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-slate-400">
        Mock login — any email / password combination works. Include "installer", "foreman", "qc", or
        "owner" in the email to preview that role.
      </p>
    </div>
  )
}
