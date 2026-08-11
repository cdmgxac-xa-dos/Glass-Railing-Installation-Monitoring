import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Loader2, Search, Plus, FileUp } from 'lucide-react'
import { DrawingListTable } from '@/components/DrawingListTable'
import { listDrawingItems, xaBulkImport, xaCreateItem } from '@/services/drawingService'
import type { DrawingItem, DrawingStatus } from '@/types'
import { DRAWING_STATUSES, STATUS_LABELS } from '@/types'

export function DrawingRegisterPage() {
  const [items, setItems] = useState<DrawingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<DrawingStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      setItems(await listDrawingItems())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        item.item_no.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, query, statusFilter])

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportBusy(true)
    setImportMsg('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null })

      const payload = rows
        .map((r) => ({
          item_no: String(r['item_no'] ?? r['ITEM NO.'] ?? r['Item No'] ?? '').trim(),
          description: String(r['description'] ?? r['DESCRIPTION'] ?? r['Description'] ?? '').trim(),
          category: r['category'] ?? r['CATEGORY'] ?? r['Category'] ?? null,
          sheet_no: r['sheet_no'] ?? r['SHEET NO.'] ?? null,
          reference: r['reference'] ?? r['REFERENCE'] ?? null,
          unit: r['unit'] ?? r['UNIT'] ?? null,
          qty: r['qty'] ?? r['QTY'] ?? r['QUANTITY'] ?? null,
          plan_reference: r['plan_reference'] ?? r['PLAN REFERENCE'] ?? null,
        }))
        .filter((r) => r.item_no && r.description)

      if (payload.length === 0) {
        setImportMsg('No rows found. Expected columns: item_no, description, category, sheet_no, reference, unit, qty.')
        return
      }
      const count = await xaBulkImport(payload)
      setImportMsg(`Imported/updated ${count} items.`)
      await refresh()
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Drawing Register</h1>
          <p className="text-sm text-brand-slate">{items.length} items, sorted by item number</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-line px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-slate-50">
            {importBusy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
            Import Excel
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} disabled={importBusy} />
          </label>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-ink px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={14} /> Add item
          </button>
        </div>
      </div>

      {importMsg && <p className="rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-ink">{importMsg}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 py-2">
          <Search size={15} className="text-brand-slate" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item no, description, category…"
            className="flex-1 text-sm outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DrawingStatus | 'all')}
          className="rounded-lg border border-brand-line bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {DRAWING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand-slate" />
        </div>
      ) : (
        <DrawingListTable items={filtered} />
      )}

      {showAdd && (
        <AddItemModal
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function AddItemModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [itemNo, setItemNo] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('assy')
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!itemNo.trim() || !description.trim()) {
      setError('Item number and description are required.')
      return
    }
    setSaving(true)
    try {
      await xaCreateItem({ item_no: itemNo.trim(), description: description.trim(), category, unit, qty: Number(qty) })
      await onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-pop">
        <h2 className="mb-4 text-base font-bold text-brand-ink">Add drawing item</h2>
        <div className="space-y-3">
          <Field label="Item No." value={itemNo} onChange={setItemNo} />
          <Field label="Description" value={description} onChange={setDescription} />
          <Field label="Category" value={category} onChange={setCategory} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit" value={unit} onChange={setUnit} />
            <Field label="Qty" value={qty} onChange={setQty} type="number" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
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
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
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
