import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, Paperclip, Loader2 } from 'lucide-react'
import type { Priority, QCResult } from '../types'
import { PRIORITIES, QC_CHECKLIST_ITEMS } from '../types'
import { submitQCInspection } from '../services/qcService'
import { addPhoto } from '../services/photoService'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'

export default function QCInspectionPage() {
  const { locationId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [itemResults, setItemResults] = useState<Record<string, boolean>>(
    Object.fromEntries(QC_CHECKLIST_ITEMS.map((i) => [i.key, true])),
  )
  const [result, setResult] = useState<QCResult | null>(null)
  const [issueDescription, setIssueDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [photoAttached, setPhotoAttached] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function toggleItem(key: string) {
    setItemResults((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later if upload fails
    if (!file) return

    setPhotoError('')
    setPhotoUploading(true)
    try {
      await addPhoto(locationId, 'Punch List', file, user?.name ?? 'QC Inspector')
      setPhotoAttached(true)
    } catch {
      setPhotoAttached(false)
      setPhotoError('Photo upload failed. Try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function handleSubmit() {
    setError('')
    if (!result) {
      setError('Select Passed or Failed to submit this inspection.')
      return
    }
    if (result === 'Failed' && !issueDescription.trim()) {
      setError('Describe the issue before submitting a Failed inspection.')
      return
    }
    setSubmitting(true)
    try {
      await submitQCInspection({
        locationId,
        itemResults,
        result,
        issueDescription: result === 'Failed' ? issueDescription : undefined,
        priority: result === 'Failed' ? priority : undefined,
        photoAttached,
        inspectedBy: user?.name ?? 'QC Inspector',
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F8FC]">
        <PageHeader title="QC Inspection" subtitle={locationId} />
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full ${
              result === 'Passed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
            }`}
          >
            {result === 'Passed' ? <Check size={32} /> : <X size={32} />}
          </div>
          <h2 className="text-lg font-extrabold text-xa-navy">Inspection recorded: {result}</h2>
          <p className="text-sm text-xa-slate">
            {result === 'Failed'
              ? 'A punch-list item has been created for this location.'
              : 'Nice work — this location passed inspection.'}
          </p>
          <button
            onClick={() => navigate(`/locations/${locationId}`)}
            className="mt-4 w-full max-w-xs rounded-2xl bg-xa-navy py-3 text-sm font-bold text-white shadow-pop"
          >
            Back to work card
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] pb-8">
      <PageHeader title="QC Inspection" subtitle={locationId} />

      <div className="space-y-5 px-4 py-5">
        <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
          <p className="mb-3 text-sm font-bold text-xa-navy">QC checklist</p>
          <div className="space-y-2">
            {QC_CHECKLIST_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleItem(item.key)}
                className="flex w-full items-center justify-between rounded-xl border border-xa-line px-3 py-2.5 text-left"
              >
                <span className="text-sm text-slate-700">{item.label}</span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    itemResults[item.key] ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {itemResults[item.key] ? <Check size={15} /> : <X size={15} />}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Overall result</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setResult('Passed')}
              className={`rounded-2xl border-2 py-4 text-center text-sm font-bold transition ${
                result === 'Passed'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-xa-line bg-white text-xa-slate'
              }`}
            >
              Passed
            </button>
            <button
              onClick={() => setResult('Failed')}
              className={`rounded-2xl border-2 py-4 text-center text-sm font-bold transition ${
                result === 'Failed' ? 'border-red-500 bg-red-50 text-red-700' : 'border-xa-line bg-white text-xa-slate'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        {result === 'Failed' && (
          <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/50 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-red-700">Issue description (required)</label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={3}
                placeholder="Describe what failed and where"
                className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-red-700">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold ${
                      priority === p ? 'border-red-500 bg-red-100 text-red-700' : 'border-red-200 bg-white text-red-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold disabled:opacity-60 ${
                photoAttached ? 'border-red-500 bg-red-100 text-red-700' : 'border-red-200 bg-white text-red-600'
              }`}
            >
              {photoUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Paperclip size={14} /> {photoAttached ? 'Photo attached' : 'Attach photo'}
                </>
              )}
            </button>
            {photoError && <p className="text-xs font-medium text-red-600">{photoError}</p>}
          </div>
        )}

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Inspection'}
        </button>
      </div>
    </div>
  )
}
