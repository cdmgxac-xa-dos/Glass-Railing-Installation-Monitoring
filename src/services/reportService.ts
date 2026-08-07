import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { ReportConfig, ReportHistoryEntry } from '../types'
import { buildReportPdf } from '../utils/reportPdfBuilder'

const BUCKET = 'glass-railing-reports'

interface GrReportHistoryRow {
  id: string
  project_code: string
  report_title: string
  config: ReportConfig
  storage_path: string
  generated_by: string
  generated_at: string
  is_automatic: boolean
}

function mapRow(row: GrReportHistoryRow): ReportHistoryEntry {
  return {
    id: row.id,
    projectCode: row.project_code,
    reportTitle: row.report_title,
    config: row.config,
    storagePath: row.storage_path,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    isAutomatic: row.is_automatic,
  }
}

// Mock-only in-memory store.
const mockReportStore: ReportHistoryEntry[] = []

export async function generateAndSaveReport(
  projectCode: string,
  config: ReportConfig,
  generatedBy: string,
): Promise<ReportHistoryEntry> {
  const { blob, title } = await buildReportPdf(projectCode, config)

  if (!isSupabaseConfigured) {
    const entry: ReportHistoryEntry = {
      id: crypto.randomUUID(),
      projectCode,
      reportTitle: title,
      config,
      storagePath: URL.createObjectURL(blob), // mock mode: storagePath doubles as a directly-openable blob URL
      generatedBy,
      generatedAt: new Date().toISOString(),
      isAutomatic: false,
    }
    mockReportStore.unshift(entry)
    return entry
  }

  const storagePath = `${projectCode}/${crypto.randomUUID()}.pdf`
  const { error: uploadError } = await supabase!.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: 'application/pdf',
  })
  if (uploadError) throw uploadError

  const { data: insertedRow, error: insertError } = await supabase!
    .from('gr_report_history')
    .insert({
      project_code: projectCode,
      report_title: title,
      config,
      storage_path: storagePath,
      generated_by: generatedBy,
      is_automatic: false,
    })
    .select('*')
    .single()

  if (insertError) {
    // Storage object was uploaded but the row insert failed — clean up the
    // orphaned object rather than leaving it unreferenced in the bucket.
    await supabase!.storage.from(BUCKET).remove([storagePath])
    throw insertError
  }
  return mapRow(insertedRow as GrReportHistoryRow)
}

export async function getReportHistory(projectCode: string): Promise<ReportHistoryEntry[]> {
  if (!isSupabaseConfigured) {
    return mockReportStore.filter((r) => r.projectCode === projectCode)
  }
  const { data, error } = await supabase!
    .from('gr_report_history')
    .select('*')
    .eq('project_code', projectCode)
    .order('generated_at', { ascending: false })
  if (error) throw error
  return (data as GrReportHistoryRow[]).map(mapRow)
}

export async function getReportDownloadUrl(storagePath: string): Promise<string> {
  if (!isSupabaseConfigured) return storagePath
  const { data, error } = await supabase!.storage.from(BUCKET).createSignedUrl(storagePath, 600)
  if (error) throw error
  return data.signedUrl
}
