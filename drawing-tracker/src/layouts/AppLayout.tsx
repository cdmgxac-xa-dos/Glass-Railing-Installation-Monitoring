import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, ListChecks, ClipboardCheck, Stamp, Users, LogOut, FileText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { AppRole } from '@/types'

const ROLE_LABEL: Record<AppRole, string> = {
  xa_admin: 'XA Admin / Site Engineer',
  draftsman: 'Draftsman',
  daaa: 'DAAA — Technical Reviewer',
  gpi: 'GPI — Final Approval',
}

const NAV: Record<AppRole, { to: string; label: string; icon: typeof LayoutDashboard }[]> = {
  xa_admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/register', label: 'Drawing Register', icon: ListChecks },
    { to: '/users', label: 'Users', icon: Users },
  ],
  draftsman: [{ to: '/', label: 'My Drawings', icon: ClipboardCheck }],
  daaa: [{ to: '/', label: 'DAAA Review Queue', icon: ClipboardCheck }],
  gpi: [{ to: '/', label: 'GPI Final Review', icon: Stamp }],
}

export function AppLayout() {
  const { profile, signOut } = useAuth()
  if (!profile) return null

  const nav = NAV[profile.role]

  return (
    <div className="min-h-screen bg-[#F4F8F8]">
      <header className="sticky top-0 z-20 border-b border-brand-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-ink text-white">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-brand-ink">Shop Drawing Tracker</p>
              <p className="text-xs leading-tight text-brand-slate">The Spinnaker at Club Laiya</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-tint text-brand-teal' : 'text-brand-slate hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-brand-ink">{profile.full_name}</p>
              <p className="text-xs text-brand-slate">{ROLE_LABEL[profile.role]}</p>
            </div>
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-line text-brand-slate hover:bg-slate-100"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-brand-line px-4 py-2 md:hidden">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-brand-tint text-brand-teal' : 'text-brand-slate'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
