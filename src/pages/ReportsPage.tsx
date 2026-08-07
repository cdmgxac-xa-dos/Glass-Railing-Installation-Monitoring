import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Download, CheckSquare, Square } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/DataContext'
import { generateAndSaveReport, getReportHistory, getReportDownloadUrl } from '../services/reportService'
import type { ReportConfig, ReportHistoryEntry } from '../types'
import PageHeader from '../components/PageHeader'

const DEFAULT_CONFIG: ReportConfig = {
  includeGeneralSummary: true,
  includeByFloor: true,
  includeByStatus: false,
  includeByUnitType: false,
  includeByBracketSystem: false,
  includeByTeam: false,
  includeByPunchList: false,
  includeFullDetail: false,
  includeFullDetailPhotos: false,
  includeFullDetailQcPunchHistory: false,
}

const CHECKBOX_ITEMS: { key: keyof ReportConfig; label: string; indent?: boolean; requires?: keyof ReportConfig }[] = [
  { key: 'includeGeneralSummary', label: 'General summary (overall % + status counts)' },
  { key: 'includeByFloor', label: 'Breakdown by floor' },
  { key: 'includeByStatus', label: 'Breakdown by status' },
  { key: 'includeByUnitType', label: 'Breakdown by unit type' },
  { key: 'includeByBracketSystem', label: 'Breakdown by bracket system' },
  { key: 'includeByTeam', label: 'Breakdown by assigned team' },
  { key: 'includeByPunchList', label: 'Punch list detail (floor, tag ID, unit, status, failed QC items, photo, priority)' },
  { key: 'includeFullDetail', label: 'Full detail — every location (tag ID)' },
  { key: 'includeFullDetailPhotos', label: 'Include photo thumbnail (last photo per location, compact)', indent: true, requires: 'includeFullDetail' },
  { key: 'includeFullDetailQcPunchHistory', label: 'Include QC & punch-list history', indent: true, requires: 'includeFullDetail' },
]

export default function ReportsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedProjectCode } = useAppData()
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG)
  const [history, setHistory] = useState<ReportHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectCode])

  async function loadHistory() {
    if (!selectedProjectCode) return
    setLoadingHistory(true)
    try {
      setHistory(await getReportHistory(selectedProjectCode))
    } catch (err) {
      console.error('Failed to load report history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  function toggle(key: keyof ReportConfig) {
    setConfig((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'includeFullDetail' && !next.includeFullDetail) {
        next.includeFullDetailPhotos = false
        next.includeFullDetailQcPunchHistory = false
      }
      return next
    })
  }

  async function handleGenerate() {
    if (!selectedProjectCode) return
    setError('')
    setGenerating(true)
    try {
      await generateAndSaveReport(selectedProjectCode, config, user?.name ?? 'Unknown')
      await loadHistory()
    } catch (err) {
      console.error('Report generation failed:', err)
      setError(err instanceof Error ? err.message : 'Report generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(entry: ReportHistoryEntry) {
    try {
      window.open(await getReportDownloadUrl(entry.storagePath), '_blank')
    } catch (err) {
      console.error('Failed to get download link:', err)
      setError('Could not open that report. Try again.')
    }
  }

  const anySelected = Object.values(config).some(Boolean)

  return (
    <div className="min-h-screen bg-[#F5F8FC] pb-8">
      <PageHeader title="Reports" subtitle="Generate & download project reports" />
      <div className="space-y-5 px-4 py-5">
        <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
          <p className="mb-3 text-sm font-bold text-xa-navy">What to include</p>
          <div className="space-y-1">
            {CHECKBOX_ITEMS.map((item) => {
              const disabled = item.requires ? !config[item.requires] : false
              const checked = config[item.key]
              return (
                <button
                  key={item.key}
                  onClick={() => !disabled && toggle(item.key)}
                  disabled={disabled}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm ${item.indent ? 'ml-6' : ''} ${disabled ? 'opacity-40' : 'hover:bg-slate-50'}`}
                >
                  {checked ? <CheckSquare size={18} className="shrink-0 text-xa-blue" /> : <Square size={18} className="shrink-0 text-slate-300" />}
                  <span className="text-slate-700">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={generating || !anySelected}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-xa-navy py-4 text-base font-bold text-white shadow-pop active:scale-[0.98] disabled:opacity-60"
        >
          {generating ? (<><Loader2 size={18} className="animate-spin" /> Generating…</>) : (<><FileText size={18} /> Generate Report</>)}
        </button>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Report history</p>
          {loadingHistory ? (
            <p className="text-sm text-xa-slate">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-xa-slate">No reports generated yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <button key={entry.id} onClick={() => handleDownload(entry)} className="flex w-full items-center justify-between rounded-2xl border border-xa-line bg-white p-4 text-left shadow-card">
                  <div>
                    <p className="text-sm font-bold text-xa-navy">{entry.reportTitle}</p>
                    <p className="text-xs text-xa-slate">{new Date(entry.generatedAt).toLocaleString()} · {entry.generatedBy}{entry.isAutomatic ? ' · Automatic' : ''}</p>
                  </div>
                  <Download size={18} className="text-xa-blue" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
