import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ShieldCheck, Users, Loader2 } from 'lucide-react'
import {
  adminExists,
  bootstrapFirstAdmin,
  loginDirectory,
  signInPasswordless,
  signInWithPassword,
} from '@/services/authService'
import { useAuth } from '@/context/AuthContext'
import type { AppRole, Profile } from '@/types'

const ROLE_TABS: { role: AppRole; label: string }[] = [
  { role: 'draftsman', label: 'Draftsman' },
  { role: 'daaa', label: 'DAAA' },
  { role: 'gpi', label: 'GPI' },
]

type Mode = 'loading' | 'bootstrap' | 'ready'

export function LoginPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [mode, setMode] = useState<Mode>('loading')
  const [directory, setDirectory] = useState<Pick<Profile, 'id' | 'full_name' | 'role'>[]>([])
  const [tab, setTab] = useState<'admin' | AppRole>('admin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Admin login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // First-run bootstrap fields
  const [bootstrapName, setBootstrapName] = useState('')
  const [bootstrapEmail, setBootstrapEmail] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const exists = await adminExists()
        if (!exists) {
          setMode('bootstrap')
          return
        }
        const dir = await loginDirectory()
        setDirectory(dir)
        setMode('ready')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not reach the server')
        setMode('ready')
      }
    }
    init()
  }, [])

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await bootstrapFirstAdmin(bootstrapName, bootstrapEmail)
      await signInWithPassword(bootstrapEmail, '0000')
      await refreshProfile()
      navigate('/change-password', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signInWithPassword(email, password)
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordlessLogin(profileId: string) {
    setBusy(true)
    setError('')
    try {
      await signInPasswordless(profileId)
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-brand-slate">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-ink px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
            <FileText size={24} />
          </div>
          <h1 className="text-xl font-bold">Shop Drawing Transparency Tracker</h1>
          <p className="mt-1 text-sm text-white/70">The Spinnaker at Club Laiya — CP19</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-pop">
          {mode === 'bootstrap' ? (
            <>
              <div className="mb-4 flex items-center gap-2 text-brand-ink">
                <ShieldCheck size={18} />
                <h2 className="font-semibold">Set up the first Admin / Site Engineer account</h2>
              </div>
              <p className="mb-4 text-sm text-brand-slate">
                No account exists yet. Create the XA Admin / Site Engineer account — it starts
                with the password <span className="font-mono font-semibold">0000</span> and you'll
                be asked to change it immediately.
              </p>
              <form onSubmit={handleBootstrap} className="space-y-3">
                <Field label="Full name" value={bootstrapName} onChange={setBootstrapName} required />
                <Field label="Email" type="email" value={bootstrapEmail} onChange={setBootstrapEmail} required />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <SubmitButton busy={busy} label="Create admin account" />
              </form>
            </>
          ) : (
            <>
              <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
                <TabButton active={tab === 'admin'} onClick={() => setTab('admin')}>
                  XA Admin
                </TabButton>
                {ROLE_TABS.map(({ role, label }) => (
                  <TabButton key={role} active={tab === role} onClick={() => setTab(role)}>
                    {label}
                  </TabButton>
                ))}
              </div>

              {tab === 'admin' ? (
                <form onSubmit={handleAdminLogin} className="space-y-3">
                  <Field label="Email" type="email" value={email} onChange={setEmail} required />
                  <Field label="Password" type="password" value={password} onChange={setPassword} required />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <SubmitButton busy={busy} label="Sign in" />
                </form>
              ) : (
                <div>
                  <div className="mb-3 flex items-center gap-2 text-sm text-brand-slate">
                    <Users size={15} />
                    No password needed — select your name to continue.
                  </div>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {directory.filter((d) => d.role === tab).length === 0 && (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm text-brand-slate">
                        No {tab.toUpperCase()} accounts yet. Ask XA to add you.
                      </p>
                    )}
                    {directory
                      .filter((d) => d.role === tab)
                      .map((d) => (
                        <button
                          key={d.id}
                          disabled={busy}
                          onClick={() => handlePasswordlessLogin(d.id)}
                          className="flex w-full items-center justify-between rounded-lg border border-brand-line px-3 py-2.5 text-left text-sm font-medium text-brand-ink transition-colors hover:border-brand-teal hover:bg-brand-tint disabled:opacity-50"
                        >
                          {d.full_name}
                        </button>
                      ))}
                  </div>
                  {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-slate">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
      />
    </label>
  )
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-ink py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {busy && <Loader2 size={15} className="animate-spin" />}
      {label}
    </button>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-white text-brand-ink shadow-sm' : 'text-brand-slate'
      }`}
    >
      {children}
    </button>
  )
}
