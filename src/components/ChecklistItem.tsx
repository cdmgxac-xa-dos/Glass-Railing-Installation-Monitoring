import { Check, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import type { ChecklistEntry } from '../types'

interface ChecklistItemProps {
  index: number
  label: string
  entry: ChecklistEntry
  onToggleComplete: () => void
  onSaveRemark: (remark: string) => void
}

// Compact by default — one row per stage, matching the assessment's
// "reduce scrolling" recommendation (section 21) for a 10-12 step
// checklist. Tapping the row (not the checkbox) expands it in place to
// show the completion timestamp and the remark editor, instead of every
// stage always rendering that detail whether or not it's needed.
export default function ChecklistItem({ index, label, entry, onToggleComplete, onSaveRemark }: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingRemark, setEditingRemark] = useState(false)
  const [remark, setRemark] = useState(entry.remark)

  return (
    <div
      className={`overflow-hidden rounded-xl border transition ${
        entry.isCompleted ? 'border-emerald-200 bg-emerald-50/50' : 'border-xa-line bg-white'
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={onToggleComplete}
          aria-label={entry.isCompleted ? 'Mark not completed' : 'Mark completed'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
            entry.isCompleted
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-300 bg-white text-transparent'
          }`}
        >
          <Check size={14} strokeWidth={3} />
        </button>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
        >
          <p className="truncate text-sm font-bold text-slate-800">
            <span className="mr-1.5 text-xa-slate">{index}.</span>
            {label}
          </p>
          <span className="flex shrink-0 items-center gap-1 text-slate-400">
            {entry.remark && <MessageSquare size={13} className="text-xa-blue" />}
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-xa-line/70 px-3 py-2.5 pl-[52px]">
          {entry.isCompleted && entry.updatedAt && (
            <p className="text-xs text-xa-slate">
              {new Date(entry.updatedAt).toLocaleString()} &middot; {entry.updatedBy}
            </p>
          )}

          {editingRemark ? (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional remark"
                className="flex-1 rounded-lg border border-xa-line px-3 py-2 text-sm outline-none focus:border-xa-blue"
              />
              <button
                onClick={() => {
                  onSaveRemark(remark)
                  setEditingRemark(false)
                }}
                className="rounded-lg bg-xa-navy px-3 py-2 text-xs font-bold text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="mt-1.5">
              {entry.remark && <p className="text-xs italic text-xa-slate">"{entry.remark}"</p>}
              <button
                onClick={() => setEditingRemark(true)}
                className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-xa-blue"
              >
                <MessageSquare size={13} />
                {entry.remark ? 'Edit remark' : 'Add remark'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
