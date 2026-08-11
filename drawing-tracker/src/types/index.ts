// ---------------------------------------------------------------------------
// Domain model for the Client Shop Drawing Transparency Tracker.
// Mirrors the Supabase schema in supabase/01_schema.sql exactly — keep the
// two in sync when either changes.
// ---------------------------------------------------------------------------

export type AppRole = 'xa_admin' | 'draftsman' | 'daaa' | 'gpi'

export interface Profile {
  id: string
  full_name: string
  role: AppRole
  email: string
  must_change_password: boolean
  created_at: string
}

export type DrawingStatus =
  | 'not_started'
  | 'assigned'
  | 'drafting'
  | 'internal_review'
  | 'submitted_to_daaa'
  | 'daaa_review'
  | 'gpi_review'
  | 'approved'
  | 'revision_required'
  | 'completed'

export const DRAWING_STATUSES: DrawingStatus[] = [
  'not_started',
  'assigned',
  'drafting',
  'internal_review',
  'submitted_to_daaa',
  'daaa_review',
  'gpi_review',
  'approved',
  'revision_required',
  'completed',
]

export const STATUS_LABELS: Record<DrawingStatus, string> = {
  not_started: 'Not Started',
  assigned: 'Assigned',
  drafting: 'Drafting',
  internal_review: 'Internal Review',
  submitted_to_daaa: 'Submitted to DAAA',
  daaa_review: 'DAAA Review',
  gpi_review: 'GPI Review',
  approved: 'Approved',
  revision_required: 'Revision Required',
  completed: 'Completed',
}

export interface DrawingItem {
  id: string
  item_no: string
  description: string
  category: string | null
  sheet_no: string | null
  reference: string | null
  unit: string | null
  qty: number | null
  plan_reference: string | null
  target_submission_date: string | null
  assigned_draftsman: string | null
  assigned_draftsman_name?: string | null
  status: DrawingStatus
  submission_date: string | null
  approval_date: string | null
  remarks: string | null
  revision_number: number
  current_pdf_id: string | null
  created_at: string
  updated_at: string
}

export interface DrawingItemWithCurrentPdf extends DrawingItem {
  current_pdf?: DrawingPdf | null
}

export interface DrawingPdf {
  id: string
  drawing_item_id: string
  revision_number: number
  storage_path: string
  file_name: string
  uploaded_by: string | null
  uploaded_by_name?: string | null
  uploaded_at: string
  is_current: boolean
}

export type ReviewAction =
  | 'created'
  | 'assigned'
  | 'started_drafting'
  | 'uploaded_pdf'
  | 'marked_complete'
  | 'returned_to_draftsman'
  | 'submitted_to_daaa'
  | 'daaa_started_review'
  | 'daaa_approved'
  | 'daaa_revision_requested'
  | 'gpi_started_review'
  | 'gpi_approved'
  | 'gpi_revision_requested'
  | 'gpi_rejected'
  | 'revision_reassigned'
  | 'marked_completed'
  | 'edited'
  | 'deleted'
  | 'remark_added'

export interface ReviewHistoryEntry {
  id: string
  drawing_item_id: string
  date: string
  user_id: string | null
  user_name: string | null
  role: AppRole | null
  action: ReviewAction
  comments: string | null
}

export interface DashboardStats {
  total: number
  completed: number
  approved: number
  revisionRequired: number
  overdue: number
  byStatus: Record<DrawingStatus, number>
}
