import { requireSupabase } from '@/lib/supabaseClient'
import type { DrawingPdf } from '@/types'

const BUCKET = 'drawing-pdfs'

function storagePathFor(itemId: string, revision: number, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${itemId}/rev-${revision}-${Date.now()}-${safeName}`
}

export async function uploadPdfAsXa(itemId: string, revisionNumber: number, file: File): Promise<DrawingPdf> {
  const path = storagePathFor(itemId, revisionNumber, file.name)
  const client = requireSupabase()

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await client.rpc('xa_upload_pdf', {
    p_item_id: itemId,
    p_storage_path: path,
    p_file_name: file.name,
  })
  if (error) throw error
  return data as DrawingPdf
}

export async function uploadPdfAsDraftsman(
  itemId: string,
  revisionNumber: number,
  file: File
): Promise<DrawingPdf> {
  const path = storagePathFor(itemId, revisionNumber, file.name)
  const client = requireSupabase()

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await client.rpc('draftsman_upload_pdf', {
    p_item_id: itemId,
    p_storage_path: path,
    p_file_name: file.name,
  })
  if (error) throw error
  return data as DrawingPdf
}

export async function listRevisions(itemId: string): Promise<DrawingPdf[]> {
  const { data, error } = await requireSupabase()
    .from('drawing_pdfs')
    .select('*, profiles(full_name)')
    .eq('drawing_item_id', itemId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data as any[]).map((row) => ({ ...row, uploaded_by_name: row.profiles?.full_name ?? null }))
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
