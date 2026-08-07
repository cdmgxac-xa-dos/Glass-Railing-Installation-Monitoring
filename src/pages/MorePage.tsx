import { useNavigate } from 'react-router-dom'
import { Building2, ClipboardList, KanbanSquare, LayoutDashboard, LogOut, Info, ChevronRight, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'

// Kept in sync with each route's ProtectedRoute allowedRoles in App.tsx.
const OWNER_DASHBOARD_ROLES = ['Project Manager', 'Owner']
const KANBAN_ROLES = ['Project Manager', 'Owner', 'Foreman']
const PUNCH_LIST_ROLES = ['Project Manager', 'Owner', 'Foreman', 'QC Inspector']
const REPORTS_ROLES = ['Project Manager', 'Owner']

export default function MorePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { clearSelection } = useAppData()

  const canSeeOwnerDashboard = user ? OWNER_DASHBOARD_ROLES.includes(user.role) : false
  const canSeeKanban = user ? KANBAN_ROLES.includes(user.role) : false
  const canSeePunchList = user ? PUNCH_LIST_ROLES.includes(user.role) : false
  const canSeeReports = user ? REPORTS_ROLES.includes(user.role) : false

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="More" showBack={false} />

      <div className="space-y-4 px-4 py-5">
        <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
          <p className="text-sm font-extrabold text-xa-navy">{user?.name}</p>
          <p className="text-xs text-xa-slate">{user?.email}</p>
          <span className="mt-2 inline-block rounded-full bg-xa-skyblue px-2.5 py-1 text-[11px] font-bold text-xa-blue">
            {user?.role}
          </span>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => navigate('/projects')}
            className="flex w-full items-center justify-between rounded-2xl border border-xa-line bg-white p-4 shadow-card"
          >
            <span className="flex items-center gap-3 text-sm font-bold text-xa-navy">
              <Building2 size={18} className="text-xa-blue" /> Switch Project
            </span>
            <ChevronRight size={18} className="text-slate-300" />
          </button>
        </div>

        {(canSeeOwnerDashboard || canSeeKanban || canSeePunchList || canSeeReports) && (
          <div className="space-y-2">
            {canSeeOwnerDashboard && (
              <button
                onClick={() => navigate('/owner-dashboard')}
                className="flex w-full items-center justify-between rounded-2xl border border-xa-line bg-white p-4 shadow-card"
              >
                <span className="flex items-center gap-3 text-sm font-bold text-xa-navy">
                  <LayoutDashboard size={18} className="text-xa-blue" /> Owner Dashboard
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            )}
            {canSeeKanban && (
              <button
                onClick={() => navigate('/kanban')}
                className="flex w-full items-center justify-between rounded-2xl border border-xa-line bg-white p-4 shadow-card"
              >
                <span className="flex items-center gap-3 text-sm font-bold text-xa-navy">
                  <KanbanSquare size={18} className="text-xa-blue" /> Production Board (Kanban)
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            )}
            {canSeePunchList && (
              <button
                onClick={() => navigate('/punch-list')}
                className="flex w-full items-center justify-between rounded-2xl border border-xa-line bg-white p-4 shadow-card"
              >
                <span className="flex items-center gap-3 text-sm font-bold text-xa-navy">
                  <ClipboardList size={18} className="text-xa-blue" /> Punch List (all locations)
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            )}
            {canSeeReports && (
              <button
                onClick={() => navigate('/reports')}
                className="flex w-full items-center justify-between rounded-2xl border border-xa-line bg-white p-4 shadow-card"
              >
                <span className="flex items-center gap-3 text-sm font-bold text-xa-navy">
                  <FileText size={18} className="text-xa-blue" /> Reports
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            )}
          </div>
        )}

        <button className="flex w-full items-center justify-between rounded-2xl border border-xa-line bg-white p-4 shadow-card">
          <span className="flex items-center gap-3 text-sm font-bold text-xa-navy">
            <Info size={18} className="text-xa-blue" /> About XA DOS
          </span>
          <ChevronRight size={18} className="text-slate-300" />
        </button>

        <button
          onClick={() => {
            logout()
            clearSelection()
            navigate('/login')
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600"
        >
          <LogOut size={18} /> Log out
        </button>
      </div>
    </div>
  )
}
