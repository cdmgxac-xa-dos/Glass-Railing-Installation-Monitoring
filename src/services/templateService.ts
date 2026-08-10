import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { ChecklistStageDef, QCChecklistItemDef } from '../types'
import {
  CHECKLIST_STAGES,
  DOORS_WINDOWS_CHECKLIST_STAGES,
  DOORS_WINDOWS_QC_ITEMS,
  QC_CHECKLIST_ITEMS,
} from '../types'

// ---------------------------------------------------------------------------
// Template service — which checklist stages / QC items apply to a given
// installation scope. Backed by checklist_templates / qc_templates (see
// supabase/05_scope_foundation.sql, 06_doors_windows_templates.sql).
//
// Mock mode has no template rows (those only exist in the real database),
// so it falls back to the matching hardcoded constant from src/types —
// those constants are also what seeded the real RAILING template rows in
// the first place, so behavior is identical either way.
// ---------------------------------------------------------------------------

const MOCK_CHECKLIST_STAGES: Record<string, ChecklistStageDef[]> = {
  RAILING: CHECKLIST_STAGES,
  DOORS_WINDOWS: DOORS_WINDOWS_CHECKLIST_STAGES,
}

const MOCK_QC_ITEMS: Record<string, QCChecklistItemDef[]> = {
  RAILING: QC_CHECKLIST_ITEMS,
  DOORS_WINDOWS: DOORS_WINDOWS_QC_ITEMS,
}

export async function getChecklistStagesForScope(scope: string): Promise<ChecklistStageDef[]> {
  if (!isSupabaseConfigured) {
    return MOCK_CHECKLIST_STAGES[scope] ?? CHECKLIST_STAGES
  }

  const { data, error } = await supabase!.from('checklist_templates').select('stages').eq('scope', scope).maybeSingle()

  if (error) throw error
  return (data?.stages as ChecklistStageDef[] | undefined) ?? CHECKLIST_STAGES
}

export async function getQcItemsForScope(scope: string): Promise<QCChecklistItemDef[]> {
  if (!isSupabaseConfigured) {
    return MOCK_QC_ITEMS[scope] ?? QC_CHECKLIST_ITEMS
  }

  const { data, error } = await supabase!.from('qc_templates').select('items').eq('scope', scope).maybeSingle()

  if (error) throw error
  return (data?.items as QCChecklistItemDef[] | undefined) ?? QC_CHECKLIST_ITEMS
}
