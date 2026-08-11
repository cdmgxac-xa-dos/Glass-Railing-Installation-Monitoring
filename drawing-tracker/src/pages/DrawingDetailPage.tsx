import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Trash2, Pencil, Calendar, Layers, Hash, Ruler } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/StatusBadge'
import { PdfPanel } from '@/components/PdfPanel'
import { Timeline } from '@/components/Timeline'
import {
  addComment,
  daaaReview,
  daaaStartReview,
  draftsmanMarkComplete,
  draftsmanStartTask,
  getDrawingItem,
  getReviewHistory,
  gpiReview,
  xaAssignDraftsman,
  xaDeleteItem,
  xaMarkCompleted,
  xaReturnToDraftsman,
  xaSubmitToDaaa,
  xaUpdateItem,
} from '@/services/drawingService'
import { uploadPdfAsDraftsman, uploadPdfAsXa } from '@/services/pdfService'
import { listAllProfiles } from '@/services/authService'
import type { DrawingItem, Profile, ReviewHistoryEntry } from '@/types'

export function DrawingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [item, setItem] = useState<DrawingItem | null>(null)
  const [history, setHistory] = useState<ReviewHistoryEntry[]>([])
  const [draftsmen, setDraftsmen] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [i, h] = await Promise.all([getDrawingItem(id), getReviewHistory(id)])
      setItem(i)
      setHistory(h)
      if (profile?.role === 'xa_admin' && draftsmen.length === 0) {
        setDraftsmen((await listAllProfiles()).filter((p) => p.role === 'draftsman'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id, profile?.role, draftsmen.length])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !item) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-slate" />
      </div>
    )
  }
  if (!item || !profile) return <p className="text-red-600">{error || 'Not found'}</p>

  const isAssignedDraftsman = profile.role === 'draftsman' && item.assigned_draftsman === profile.id
  const canComment =
    profile.role !== 'draftsman' || isAssignedDraftsman

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-slate hover:text-brand-ink"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div className="mb-4 rounded-2xl border border-brand-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Item {item.item_no}</p>
            <h1 className="text-lg font-bold text-brand-ink">{item.description}</h1>
            {item.category && <p className="text-sm text-brand-slate">{item.category}</p>}
          </div>
          <StatusBadge status={item.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-brand-line pt-4 text-sm sm:grid-cols-4">
          <InfoStat icon={Hash} label="Sheet No." value={item.sheet_no || '—'} />
          <InfoStat icon={Ruler} label="Qty" value={item.qty != null ? `${item.qty} ${item.unit ?? ''}` : '—'} />
          <InfoStat icon={Layers} label="Revision" value={`Rev ${item.revision_number}`} />
          <InfoStat
            icon={Calendar}
            label="Target Date"
            value={item.target_submission_date ?? 'Not set'}
          />
        </div>

        {item.reference && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold text-brand-slate">Reference</p>
            <p className="whitespace-pre-wrap text-sm text-brand-ink">{item.reference}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-brand-slate">Assigned draftsman: </span>
            <span className="font-medium text-brand-ink">{item.assigned_draftsman_name ?? 'Unassigned'}</span>
          </p>
          <p>
            <span className="text-brand-slate">Submitted: </span>
            <span className="font-medium text-brand-ink">{item.submission_date ?? '—'}</span>
          </p>
          <p>
            <span className="text-brand-slate">Approved: </span>
            <span className="font-medium text-brand-ink">{item.approval_date ?? '—'}</span>
          </p>
          <p>
            <span className="text-brand-slate">Plan reference: </span>
            <span className="font-medium text-brand-ink">{item.plan_reference ?? '—'}</span>
          </p>
        </div>

        {item.remarks && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span className="font-semibold">Remarks: </span>
            {item.remarks}
          </div>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Panel title="Drawing PDF">
          <PdfPanel
            itemId={item.id}
            currentPdfId={item.current_pdf_id}
            canUpload={
              (profile.role === 'xa_admin') ||
              (isAssignedDraftsman && item.status === 'drafting')
            }
            onUpload={async (file) => {
              if (profile.role === 'xa_admin') {
                await uploadPdfAsXa(item.id, item.revision_number, file)
              } else {
                await uploadPdfAsDraftsman(item.id, item.revision_number, file)
              }
              await load()
            }}
          />
        </Panel>

        <Panel title="Actions">
          <RoleActions
            item={item}
            profile={profile}
            draftsmen={draftsmen}
            busy={busy}
            isAssignedDraftsman={isAssignedDraftsman}
            run={run}
            onEdit={() => setEditing(true)}
          />
        </Panel>
      </div>

      {editing && (
        <EditModal
          item={item}
          onClose={() => setEditing(false)}
          onSave={async (payload) => {
            await run(() => xaUpdateItem(item.id, payload))
            setEditing(false)
          }}
        />
      )}

      <Panel title="Submission & Approval History">
        <Timeline
          entries={history}
          onAddComment={canComment ? (text) => run(() => addComment(item.id, text)) : undefined}
        />
      </Panel>
    </div>
  )
}

function InfoStat({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-brand-slate">
        <Icon size={12} /> {label}
      </p>
      <p className="font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-card">
      <h2 className="mb-3 text-sm font-bold text-brand-ink">{title}</h2>
      {children}
    </div>
  )
}

function RoleActions({
  item,
  profile,
  draftsmen,
  busy,
  isAssignedDraftsman,
  run,
  onEdit,
}: {
  item: DrawingItem
  profile: Profile
  draftsmen: Profile[]
  busy: boolean
  isAssignedDraftsman: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  onEdit: () => void
}) {
  const [draftsmanId, setDraftsmanId] = useState(item.assigned_draftsman ?? '')
  const [targetDate, setTargetDate] = useState(item.target_submission_date ?? '')
  const [reviewComments, setReviewComments] = useState('')

  const btn =
    'w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 transition-opacity'
  const primary = `${btn} bg-brand-ink text-white hover:opacity-90`
  const danger = `${btn} bg-red-600 text-white hover:opacity-90`
  const success = `${btn} bg-green-600 text-white hover:opacity-90`
  const secondary = `${btn} border border-brand-line text-brand-ink hover:bg-slate-50`

  if (profile.role === 'xa_admin') {
    return (
      <div className="space-y-4">
        <button onClick={onEdit} className={secondary} disabled={busy}>
          <span className="flex items-center justify-center gap-1.5">
            <Pencil size={14} /> Edit drawing details
          </span>
        </button>

        <div className="rounded-lg border border-brand-line p-3">
          <p className="mb-2 text-xs font-semibold text-brand-slate">Assign / reassign draftsman</p>
          <select
            value={draftsmanId}
            onChange={(e) => setDraftsmanId(e.target.value)}
            className="mb-2 w-full rounded-lg border border-brand-line px-2 py-1.5 text-sm"
          >
            <option value="">Select draftsman…</option>
            {draftsmen.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mb-2 w-full rounded-lg border border-brand-line px-2 py-1.5 text-sm"
          />
          <button
            disabled={busy || !draftsmanId}
            onClick={() => run(() => xaAssignDraftsman(item.id, draftsmanId, targetDate || undefined))}
            className={primary}
          >
            {item.status === 'revision_required' ? 'Reassign for revision' : 'Assign'}
          </button>
        </div>

        {item.status === 'internal_review' && (
          <>
            <button disabled={busy} onClick={() => run(() => xaSubmitToDaaa(item.id))} className={success}>
              Submit to DAAA
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => xaReturnToDraftsman(item.id))}
              className={secondary}
            >
              Return to draftsman
            </button>
          </>
        )}

        {item.status === 'approved' && (
          <button disabled={busy} onClick={() => run(() => xaMarkCompleted(item.id))} className={success}>
            Mark completed
          </button>
        )}

        <button
          disabled={busy}
          onClick={() => {
            if (confirm(`Delete drawing item ${item.item_no}? This cannot be undone.`)) {
              run(() => xaDeleteItem(item.id))
            }
          }}
          className={danger}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Trash2 size={14} /> Delete item
          </span>
        </button>
      </div>
    )
  }

  if (profile.role === 'draftsman') {
    if (!isAssignedDraftsman) {
      return <p className="text-sm text-brand-slate">This drawing is not assigned to you.</p>
    }
    return (
      <div className="space-y-2">
        {item.status === 'assigned' && (
          <button disabled={busy} onClick={() => run(() => draftsmanStartTask(item.id))} className={primary}>
            Start task
          </button>
        )}
        {item.status === 'drafting' && (
          <button
            disabled={busy || !item.current_pdf_id}
            onClick={() => run(() => draftsmanMarkComplete(item.id))}
            className={success}
          >
            Mark complete
          </button>
        )}
        {item.status === 'drafting' && !item.current_pdf_id && (
          <p className="text-xs text-brand-slate">Upload a PDF before marking this complete.</p>
        )}
        {!['assigned', 'drafting'].includes(item.status) && (
          <p className="text-sm text-brand-slate">Waiting on review — no action needed right now.</p>
        )}
      </div>
    )
  }

  if (profile.role === 'daaa') {
    if (!['submitted_to_daaa', 'daaa_review'].includes(item.status)) {
      return <p className="text-sm text-brand-slate">This drawing is not currently with DAAA.</p>
    }
    return (
      <div className="space-y-2">
        {item.status === 'submitted_to_daaa' && (
          <button disabled={busy} onClick={() => run(() => daaaStartReview(item.id))} className={secondary}>
            Start review
          </button>
        )}
        <textarea
          value={reviewComments}
          onChange={(e) => setReviewComments(e.target.value)}
          placeholder="Comments (required to request a revision)"
          rows={3}
          className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <button
          disabled={busy}
          onClick={() => run(() => daaaReview(item.id, 'approve', reviewComments || undefined))}
          className={success}
        >
          Approve technical review
        </button>
        <button
          disabled={busy || !reviewComments.trim()}
          onClick={() => run(() => daaaReview(item.id, 'revision_required', reviewComments))}
          className={danger}
        >
          Request revision
        </button>
      </div>
    )
  }

  if (profile.role === 'gpi') {
    if (item.status !== 'gpi_review') {
      return <p className="text-sm text-brand-slate">This drawing is not currently with GPI.</p>
    }
    return (
      <div className="space-y-2">
        <textarea
          value={reviewComments}
          onChange={(e) => setReviewComments(e.target.value)}
          placeholder="Comments (required to request a revision or reject)"
          rows={3}
          className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
        <button
          disabled={busy}
          onClick={() => run(() => gpiReview(item.id, 'approve', reviewComments || undefined))}
          className={success}
        >
          Approve final drawing
        </button>
        <button
          disabled={busy || !reviewComments.trim()}
          onClick={() => run(() => gpiReview(item.id, 'revision_required', reviewComments))}
          className={secondary}
        >
          Request revision
        </button>
        <button
          disabled={busy || !reviewComments.trim()}
          onClick={() => run(() => gpiReview(item.id, 'reject', reviewComments))}
          className={danger}
        >
          Reject submission
        </button>
      </div>
    )
  }

  return null
}

function EditModal({
  item,
  onClose,
  onSave,
}: {
  item: DrawingItem
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => Promise<void>
}) {
  const [description, setDescription] = useState(item.description)
  const [category, setCategory] = useState(item.category ?? '')
  const [sheetNo, setSheetNo] = useState(item.sheet_no ?? '')
  const [reference, setReference] = useState(item.reference ?? '')
  const [unit, setUnit] = useState(item.unit ?? '')
  const [qty, setQty] = useState(item.qty?.toString() ?? '')
  const [remarks, setRemarks] = useState(item.remarks ?? '')
  const [targetDate, setTargetDate] = useState(item.target_submission_date ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onSave({
        description,
        category,
        sheet_no: sheetNo,
        reference,
        unit,
        qty: qty ? Number(qty) : undefined,
        remarks,
        target_submission_date: targetDate || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-pop">
        <h2 className="mb-4 text-base font-bold text-brand-ink">Edit {item.item_no}</h2>
        <div className="space-y-3">
          <LabeledInput label="Description" value={description} onChange={setDescription} />
          <LabeledInput label="Category" value={category} onChange={setCategory} />
          <LabeledInput label="Sheet No." value={sheetNo} onChange={setSheetNo} />
          <div>
            <span className="mb-1 block text-xs font-semibold text-brand-slate">Reference</span>
            <textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Unit" value={unit} onChange={setUnit} />
            <LabeledInput label="Qty" value={qty} onChange={setQty} type="number" />
          </div>
          <LabeledInput label="Target submission date" value={targetDate} onChange={setTargetDate} type="date" />
          <div>
            <span className="mb-1 block text-xs font-semibold text-brand-slate">Remarks</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-brand-line px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-slate">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm"
      />
    </label>
  )
}
