import { useState } from 'react'
import { UserCog } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { USER_ROLES } from '../types'

// Development-mode role switcher so every role's interface can be tested
// without logging in and out. Hidden from installer accounts is not
// applicable here — this tool itself is only for testing all roles.
export default function RoleSwitcher() {
  const { user, switchRole } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <div className="fixed bottom-20 right-3 z-40">
      {open && (
        <div className="mb-2 w-48 rounded-xl border border-xa-line bg-white p-2 shadow-pop">
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-xa-slate">
            Dev role switcher
          </p>
          {USER_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => {
                switchRole(role)
                setOpen(false)
              }}
              className={`block w-full rounded-lg px-2 py-2 text-left text-sm font-medium ${
                role === user.role ? 'bg-xa-skyblue text-xa-navy' : 'text-slate-600 active:bg-slate-50'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch role (dev)"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-xa-navy text-white shadow-pop active:scale-95"
      >
        <UserCog size={20} />
      </button>
    </div>
  )
}
