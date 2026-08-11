import { useEffect, useState } from 'react'
import { FileText, Upload, ExternalLink, Loader2, History } from 'lucide-react'
import { getSignedUrl, listRevisions } from '@/services/pdfService'
import type { DrawingPdf } from '@/types'

export function PdfPanel({
  itemId,
  currentPdfId,
  canUpload,
  onUpload,
}: {
  itemId: string
  currentPdfId: string | null
  canUpload: boolean
  onUpload?: (file: File) => Promise<void>
}) {
  const [revisions, setRevisions] = useState<DrawingPdf[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setRevisions(await listRevisions(itemId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, currentPdfId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUpload) return
    setUploading(true)
    try {
      await onUpload(file)
      await refresh()
    } finally {
      setUploading(false)
    }
  }

  async function view(path: string) {
    const url = await getSignedUrl(path)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const current = revisions.find((r) => r.is_current)
  const past = revisions.filter((r) => !r.is_current)

  if (loading) return <Loader2 className="animate-spin text-brand-slate" size={18} />

  return (
    <div>
      {current ? (
        <button
          onClick={() => view(current.storage_path)}
          className="flex w-full items-center justify-between rounded-lg border border-brand-line bg-brand-tint px-3 py-3 text-left hover:border-brand-teal"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText size={18} className="shrink-0 text-brand-teal" />
            <div className="overflow-hidden">
              <p className="truncate text-sm font-semibold text-brand-ink">{current.file_name}</p>
              <p className="text-xs text-brand-slate">
                Rev {current.revision_number} · uploaded {new Date(current.uploaded_at).toLocaleDateString()}
                {current.uploaded_by_name ? ` by ${current.uploaded_by_name}` : ''}
              </p>
            </div>
          </div>
          <ExternalLink size={15} className="shrink-0 text-brand-teal" />
        </button>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-brand-slate">No PDF uploaded yet.</p>
      )}

      {canUpload && (
        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand-line py-2.5 text-sm font-medium text-brand-slate hover:border-brand-teal hover:text-brand-teal">
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? 'Uploading…' : current ? 'Replace with new revision' : 'Upload PDF'}
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
      )}

      {past.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand-slate hover:text-brand-teal"
          >
            <History size={13} />
            {showHistory ? 'Hide' : 'Show'} {past.length} earlier revision{past.length > 1 ? 's' : ''}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {past.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => view(r.storage_path)}
                    className="flex w-full items-center justify-between rounded-lg border border-brand-line px-3 py-2 text-left text-xs hover:border-brand-teal"
                  >
                    <span className="truncate text-brand-ink">
                      Rev {r.revision_number} — {r.file_name}
                    </span>
                    <span className="shrink-0 text-brand-slate">
                      {new Date(r.uploaded_at).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
