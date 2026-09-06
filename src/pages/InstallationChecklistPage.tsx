import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { ChecklistStageDef, ChecklistState } from '../types'
import { getChecklist, getChecklistStagesForLocation, updateChecklistStage } from '../services/checklistService'
import { useAuth } from '../context/AuthContext'
import { useLocationReference } from '../hooks/useLocationReference'
import PageHeader from '../components/PageHeader'
import ChecklistItem from '../components/ChecklistItem'

export default function InstallationChecklistPage() {
  const { locationId = '' } = useParams()
  const { user } = useAuth()
  const reference = useLocationReference(locationId)
  const [stages, setStages] = useState<ChecklistStageDef[]>([])
  const [checklist, setChecklist] = useState<ChecklistState | null>(null)

  useEffect(() => {
    Promise.all([getChecklistStagesForLocation(locationId), getChecklist(locationId)]).then(([s, c]) => {
      setStages(s)
      setChecklist(c)
    })
  }, [locationId])

  async function handleToggleComplete(stageKey: string) {
    if (!checklist) return
    const isCompleted = !checklist[stageKey].isCompleted
    const updated = await updateChecklistStage(locationId, stageKey, {
      isCompleted,
      updatedBy: user?.name ?? 'Field User',
    })
    setChecklist({ ...updated })
  }

  async function handleSaveRemark(stageKey: string, remark: string) {
    if (!checklist) return
    const updated = await updateChecklistStage(locationId, stageKey, {
      remark,
      updatedBy: user?.name ?? 'Field User',
    })
    setChecklist({ ...updated })
  }

  const completedCount = checklist ? Object.values(checklist).filter((c) => c.isCompleted).length : 0
  const pct = checklist && stages.length ? Math.round((completedCount / stages.length) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Installation Checklist" subtitle={reference} />

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold text-xa-slate">Stages completed</p>
            <p className="font-extrabold text-xa-navy">{completedCount}/{stages.length}</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-xa-blue transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-2 px-4 py-5">
        {checklist &&
          stages.map((stage, i) => (
            <ChecklistItem
              key={stage.key}
              index={i + 1}
              label={stage.label}
              entry={checklist[stage.key]}
              onToggleComplete={() => handleToggleComplete(stage.key)}
              onSaveRemark={(remark) => handleSaveRemark(stage.key, remark)}
            />
          ))}
      </div>
    </div>
  )
}
