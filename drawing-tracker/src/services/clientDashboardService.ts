import { requireSupabase } from '@/lib/supabaseClient'
import type { DrawingStatus } from '@/types'

export interface ClientDrawingRow {
  id: string
  item_no: string
  description: string
  category: string | null
  unit: string | null
  qty: number | null
  target_submission_date: string | null
  status: DrawingStatus
  submission_date: string | null
  approval_date: string | null
  revision_number: number
}

export interface ClientPdfRow {
  drawing_item_id: string
  revision_number: number
  storage_path: string
  file_name: string
  uploaded_at: string
}

export interface ClientTimelineRow {
  drawing_item_id: string
  date: string
  action: string
  comments: string | null
  role: string | null
}

export async function fetchClientDrawings(): Promise<ClientDrawingRow[]> {
  const { data, error } = await requireSupabase()
    .from('client_dashboard_view')
    .select('*')
    .order('item_no', { ascending: true })
  if (error) throw error
  return data as ClientDrawingRow[]
}

export async function fetchClientApprovedPdfs(): Promise<ClientPdfRow[]> {
  const { data, error } = await requireSupabase().from('client_dashboard_pdfs').select('*')
  if (error) throw error
  return data as ClientPdfRow[]
}

export async function fetchClientTimeline(): Promise<ClientTimelineRow[]> {
  const { data, error } = await requireSupabase()
    .from('client_dashboard_timeline')
    .select('*')
    .order('date', { ascending: false })
    .limit(100)
  if (error) throw error
  return data as ClientTimelineRow[]
}

export async function getPublicSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from('drawing-pdfs')
    .createSignedUrl(storagePath, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
