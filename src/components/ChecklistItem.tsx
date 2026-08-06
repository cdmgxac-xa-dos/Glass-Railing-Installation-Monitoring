import { Check, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import type { ChecklistEntry } from '../types'

interface ChecklistItemProps {
  index: number
  label: string
  entry: ChecklistEntry
  onToggleComplete: () => void
  onSaveRemark: (remark: string) => void
}

export default function ChecklistItem({ index, label, entry, onToggleComplete, onSaveRemark }: ChecklistItemProps) {
  const [showRemark, setShowRemark] = useState(false)
  const [remark, setRemark] = useState(entry.remark)

  return (
    <div
      className={`rounded-2xl border p-4 shadow-card transition ${
        entry.isCompleted ? 'border-emerald-200 bg-emerald-50/50' : 'border-xa-line bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleComplete}
          aria-label={entry.isCompleted ? 'Mark not completed' : 'Mark completed'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
            entry.isCompleted
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-300 bg-white text-transparent'
          }`}
        >
          <Check size={18} strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">
              <span className="mr-1.5 text-xa-slate">{index}.</span>
              {label}
            </p>
          </div>

          {entry.isCompleted && entry.updatedAt && (
            <p className="mt-1 text-xs text-xa-slate">
              {new Date(entry.updatedAt).toLocaleString()} &middot; {entry.updatedBy}
            </p>
          )}

          <button
            onClick={() => setShowRemark((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-xa-blue"
          >
            <MessageSquare size={13} />
            {entry.remark ? 'Edit remark' : 'Add remark'}
          </button>

          {showRemark && (
            <div className="mt-2 flex gap-2">
              <input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional remark"
                className="flex-1 rounded-lg border border-xa-line px-3 py-2 text-sm outline-none focus:border-xa-blue"
              />
              <button
                onClick={() => {
                  onSaveRemark(remark)
                  setShowRemark(false)
                }}
                className="rounded-lg bg-xa-navy px-3 py-2 text-xs font-bold text-white"
              >
                Save
              </button>
            </div>
          )}

          {!showRemark && entry.remark && <p className="mt-1 text-xs italic text-xa-slate">"{entry.remark}"</p>}
        </div>
      </div>
    </div>
  )
}
