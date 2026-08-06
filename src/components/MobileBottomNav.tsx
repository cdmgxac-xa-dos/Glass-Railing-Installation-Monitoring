import { Home, Layers, ListChecks, LayoutDashboard, MoreHorizontal } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/project', label: 'Home', icon: Home, end: true },
  { to: '/floors', label: 'Floors', icon: Layers },
  { to: '/locations', label: 'Tasks', icon: ListChecks },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/more', label: 'More', icon: MoreHorizontal },
]

export default function MobileBottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-xa-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                isActive ? 'text-xa-blue' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
