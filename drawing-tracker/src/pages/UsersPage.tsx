import { useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { createAccount, listAllProfiles } from '@/services/authService'
import type { AppRole, Profile } from '@/types'

const ROLE_LABEL: Record<AppRole, string> = {
  xa_admin: 'XA Admin / Site Engineer',
  draftsman: 'Draftsman',
  daaa: 'DAAA',
  gpi: 'GPI',
}

export function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppRole>('draftsman')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      setProfiles(await listAllProfiles())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setCreating(true)
    try {
      await createAccount(fullName.trim(), email.trim(), role)
      setNotice(
        role === 'xa_admin'
          ? `${fullName} can now sign in with password 0000 (forced change on first login).`
          : `${fullName} can now sign in from the login screen — no password needed.`
      )
      setFullName('')
      setEmail('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">Users</h1>
        <p className="text-sm text-brand-slate">Manage XA, Draftsman, DAAA and GPI accounts</p>
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-brand-ink">
          <UserPlus size={15} /> Add account
        </h2>
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-slate">Full name</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-brand-slate">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-brand-slate">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
            >
              {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          {notice && <p className="text-sm text-green-700 sm:col-span-2">{notice}</p>}
          <button
            type="submit"
            disabled={creating}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            Create account
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-brand-line bg-white shadow-card">
        <h2 className="border-b border-brand-line p-4 text-sm font-bold text-brand-ink">All accounts</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-brand-slate" />
          </div>
        ) : (
          <div className="divide-y divide-brand-line">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-brand-ink">{p.full_name}</p>
                  <p className="text-xs text-brand-slate">{p.email}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-brand-slate">
                  {ROLE_LABEL[p.role]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
