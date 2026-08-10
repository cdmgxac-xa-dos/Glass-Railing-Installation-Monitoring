import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { getScopesForProject, type ScopeSummary } from '../services/scopeService'
import { useAppData } from '../context/DataContext'

// Sits between Project Selection and the project dashboard. Today every
// project has data for exactly one installation scope (Railings), so this
// resolves instantly and sends the user straight through without ever
// showing a screen — it only starts prompting once a project has more than
// one scope's worth of data (e.g. once Doors & Windows locations exist).
export default function ScopeSelectionPage() {
  const navigate = useNavigate()
  const { selectedProjectCode, setSelectedScope } = useAppData()
  const [scopes, setScopes] = useState<ScopeSummary[] | null>(null)

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects', { replace: true })
      return
    }
    getScopesForProject(selectedProjectCode).then((result) => {
      if (result.length <= 1) {
        setSelectedScope(result[0]?.code ?? null)
        navigate('/project', { replace: true })
        return
      }
      setScopes(result)
    })
  }, [selectedProjectCode, navigate, setSelectedScope])

  function selectScope(code: string) {
    setSelectedScope(code)
    navigate('/project')
  }

  if (!scopes) return null

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F8FC] pb-6">
      <header className="bg-xa-navy px-5 pb-6 pt-10 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Select installation scope</p>
        <h1 className="mt-1 text-xl font-extrabold">What are you working on?</h1>
      </header>

      <div className="flex-1 space-y-3 px-5 pt-5">
        {scopes.map((scope) => (
          <button
            key={scope.code}
            onClick={() => selectScope(scope.code)}
            className="w-full rounded-2xl border border-xa-line bg-white p-4 text-left shadow-card transition active:scale-[0.99] active:bg-xa-skyblue"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-xa-navy">{scope.name}</p>
                <p className="mt-1 text-xs font-semibold text-xa-slate">{scope.locationCount} locations</p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-slate-300" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
