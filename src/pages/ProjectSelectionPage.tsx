import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import type { Project } from '../types'
import { getProjects } from '../services/projectService'
import { useAppData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'

export default function ProjectSelectionPage() {
  const navigate = useNavigate()
  const { setSelectedProjectCode, setSelectedFloor, setSelectedUnitType } = useAppData()
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    getProjects().then(setProjects)
  }, [])

  function selectProject(project: Project) {
    if (project.totalLocations === 0) return
    setSelectedProjectCode(project.code)
    setSelectedFloor(null)
    setSelectedUnitType(null)
    navigate('/project')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F8FC] pb-6">
      <header className="bg-xa-navy px-5 pb-6 pt-10 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Welcome{user ? `, ${user.name.split(' ')[0]}` : ''}</p>
        <h1 className="mt-1 text-xl font-extrabold">Select a project</h1>
      </header>

      <div className="flex-1 space-y-3 px-5 pt-5">
        {projects.map((project) => {
          const disabled = project.totalLocations === 0
          return (
            <button
              key={project.id}
              onClick={() => selectProject(project)}
              disabled={disabled}
              className={`w-full rounded-2xl border bg-white p-4 text-left shadow-card transition active:scale-[0.99] ${
                disabled ? 'border-dashed border-slate-200 opacity-60' : 'border-xa-line active:bg-xa-skyblue'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-xa-blue">{project.code}</p>
                  <p className="mt-0.5 truncate text-base font-extrabold text-xa-navy">{project.name}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-xa-slate">
                    <MapPin size={12} /> {project.location}
                  </p>
                </div>
                <ChevronRight size={20} className="shrink-0 text-slate-300" />
              </div>
              <div className="mt-3 border-t border-xa-line pt-2 text-xs font-semibold text-xa-slate">
                {disabled ? 'No records yet' : `${project.totalLocations} railing locations`}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
