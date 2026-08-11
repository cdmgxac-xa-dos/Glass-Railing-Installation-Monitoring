import { requireSupabase } from '@/lib/supabaseClient'
import type { DashboardStats, DrawingItem, DrawingStatus, ReviewHistoryEntry } from '@/types'
import { DRAWING_STATUSES } from '@/types'

const ITEM_SELECT = `*, assigned_profile:profiles!drawing_items_assigned_draftsman_fkey(full_name)`

function mapItem(row: any): DrawingItem {
  const { assigned_profile, ...rest } = row
  return { ...rest, assigned_draftsman_name: assigned_profile?.full_name ?? null }
}

export async function listDrawingItems(): Promise<DrawingItem[]> {
  const { data, error } = await requireSupabase()
    .from('drawing_items')
    .select(ITEM_SELECT)
    .order('item_no', { ascending: true })
  if (error) throw error
  return (data as any[]).map(mapItem).sort(byItemNo)
}

export async function getDrawingItem(id: string): Promise<DrawingItem> {
  const { data, error } = await requireSupabase()
    .from('drawing_items')
    .select(ITEM_SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return mapItem(data)
}

export async function listMyAssignedItems(draftsmanId: string): Promise<DrawingItem[]> {
  const { data, error } = await requireSupabase()
    .from('drawing_items')
    .select(ITEM_SELECT)
    .eq('assigned_draftsman', draftsmanId)
    .order('item_no', { ascending: true })
  if (error) throw error
  return (data as any[]).map(mapItem).sort(byItemNo)
}

export async function listByStatus(statuses: DrawingStatus[]): Promise<DrawingItem[]> {
  const { data, error } = await requireSupabase()
    .from('drawing_items')
    .select(ITEM_SELECT)
    .in('status', statuses)
    .order('item_no', { ascending: true })
  if (error) throw error
  return (data as any[]).map(mapItem).sort(byItemNo)
}

export async function getReviewHistory(itemId: string): Promise<ReviewHistoryEntry[]> {
  const { data, error } = await requireSupabase()
    .from('review_history')
    .select('*, profiles(full_name)')
    .eq('drawing_item_id', itemId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data as any[]).map((row) => ({
    ...row,
    user_name: row.profiles?.full_name ?? null,
  }))
}

export function computeStats(items: DrawingItem[]): DashboardStats {
  const byStatus = Object.fromEntries(DRAWING_STATUSES.map((s) => [s, 0])) as Record<DrawingStatus, number>
  let overdue = 0
  const today = new Date().toISOString().slice(0, 10)
  for (const item of items) {
    byStatus[item.status]++
    if (
      item.target_submission_date &&
      item.target_submission_date < today &&
      !['approved', 'completed'].includes(item.status)
    ) {
      overdue++
    }
  }
  return {
    total: items.length,
    completed: byStatus.completed,
    approved: byStatus.approved,
    revisionRequired: byStatus.revision_required,
    overdue,
    byStatus,
  }
}

// --- RPC-backed mutations ---------------------------------------------------

export async function xaCreateItem(payload: {
  item_no: string
  description: string
  category?: string
  sheet_no?: string
  reference?: string
  unit?: string
  qty?: number
  plan_reference?: string
  target_submission_date?: string
}) {
  const { error } = await requireSupabase().rpc('xa_create_drawing_item', {
    p_item_no: payload.item_no,
    p_description: payload.description,
    p_category: payload.category ?? null,
    p_sheet_no: payload.sheet_no ?? null,
    p_reference: payload.reference ?? null,
    p_unit: payload.unit ?? null,
    p_qty: payload.qty ?? null,
    p_plan_reference: payload.plan_reference ?? null,
    p_target_submission_date: payload.target_submission_date ?? null,
  })
  if (error) throw error
}

export async function xaUpdateItem(
  itemId: string,
  payload: Partial<{
    description: string
    category: string
    sheet_no: string
    reference: string
    unit: string
    qty: number
    plan_reference: string
    target_submission_date: string
    remarks: string
  }>
) {
  const { error } = await requireSupabase().rpc('xa_update_drawing_item', {
    p_item_id: itemId,
    p_description: payload.description ?? null,
    p_category: payload.category ?? null,
    p_sheet_no: payload.sheet_no ?? null,
    p_reference: payload.reference ?? null,
    p_unit: payload.unit ?? null,
    p_qty: payload.qty ?? null,
    p_plan_reference: payload.plan_reference ?? null,
    p_target_submission_date: payload.target_submission_date ?? null,
    p_remarks: payload.remarks ?? null,
  })
  if (error) throw error
}

export async function xaDeleteItem(itemId: string) {
  const { error } = await requireSupabase().rpc('xa_delete_drawing_item', { p_item_id: itemId })
  if (error) throw error
}

export async function xaAssignDraftsman(
  itemId: string,
  draftsmanId: string,
  targetDate?: string,
  comments?: string
) {
  const { error } = await requireSupabase().rpc('xa_assign_draftsman', {
    p_item_id: itemId,
    p_draftsman_id: draftsmanId,
    p_target_date: targetDate ?? null,
    p_comments: comments ?? null,
  })
  if (error) throw error
}

export async function xaSubmitToDaaa(itemId: string, comments?: string) {
  const { error } = await requireSupabase().rpc('xa_submit_to_daaa', {
    p_item_id: itemId,
    p_comments: comments ?? null,
  })
  if (error) throw error
}

export async function xaReturnToDraftsman(itemId: string, comments?: string) {
  const { error } = await requireSupabase().rpc('xa_return_to_draftsman', {
    p_item_id: itemId,
    p_comments: comments ?? null,
  })
  if (error) throw error
}

export async function xaMarkCompleted(itemId: string, comments?: string) {
  const { error } = await requireSupabase().rpc('xa_mark_completed', {
    p_item_id: itemId,
    p_comments: comments ?? null,
  })
  if (error) throw error
}

export async function draftsmanStartTask(itemId: string) {
  const { error } = await requireSupabase().rpc('draftsman_start_task', { p_item_id: itemId })
  if (error) throw error
}

export async function draftsmanMarkComplete(itemId: string, comments?: string) {
  const { error } = await requireSupabase().rpc('draftsman_mark_complete', {
    p_item_id: itemId,
    p_comments: comments ?? null,
  })
  if (error) throw error
}

export async function addComment(itemId: string, comments: string) {
  const { error } = await requireSupabase().rpc('add_comment', {
    p_item_id: itemId,
    p_comments: comments,
  })
  if (error) throw error
}

export async function daaaStartReview(itemId: string) {
  const { error } = await requireSupabase().rpc('daaa_start_review', { p_item_id: itemId })
  if (error) throw error
}

export async function daaaReview(itemId: string, decision: 'approve' | 'revision_required', comments?: string) {
  const { error } = await requireSupabase().rpc('daaa_review', {
    p_item_id: itemId,
    p_decision: decision,
    p_comments: comments ?? null,
  })
  if (error) throw error
}

export async function gpiReview(
  itemId: string,
  decision: 'approve' | 'revision_required' | 'reject',
  comments?: string
) {
  const { error } = await requireSupabase().rpc('gpi_review', {
    p_item_id: itemId,
    p_decision: decision,
    p_comments: comments ?? null,
  })
  if (error) throw error
}

export async function xaBulkImport(items: Record<string, unknown>[]): Promise<number> {
  const { data, error } = await requireSupabase().rpc('xa_bulk_import_items', { p_items: items })
  if (error) throw error
  return data as number
}

function byItemNo(a: DrawingItem, b: DrawingItem) {
  return naturalItemNo(a.item_no) - naturalItemNo(b.item_no) || a.item_no.localeCompare(b.item_no)
}

/** "6.10" must sort after "6.9", and "5.0-v2" right after "5.0". */
function naturalItemNo(itemNo: string): number {
  const [base] = itemNo.split('-v')
  const [whole, sub] = base.split('.')
  const w = Number(whole) || 0
  const s = Number(sub) || 0
  return w * 1000 + s
}
