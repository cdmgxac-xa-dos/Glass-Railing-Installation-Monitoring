-- ============================================================================
-- Give the PIC role (real role_code 'field_pic') access to Production
-- Kanban and Reports, alongside Owner / Project Manager.
--
-- Kanban needs no DB change: the board reads locations via gr_can_read()
-- and moves cards via gr_can_write() — both already-general field_ops
-- checks that field_pic already passes today (same permission the
-- ungated Update Status / Installation Checklist screens already rely
-- on). Only the client-side route gate in App.tsx was closed for PIC;
-- that's fixed in the app code, not here.
--
-- Reports is different: gr_report_history and the glass-railing-reports
-- bucket are gated by gr_is_owner_or_pm(), a hardcoded role_code
-- allowlist (not the general field_ops matrix) that explicitly excluded
-- field_pic. This migration widens that allowlist to include it. Safe to
-- do directly since gr_is_owner_or_pm() is only ever referenced by the
-- Reports feature (see schema.sql's gr_report_history policies + the
-- glass-railing-reports bucket policies + 02_project_scoping_rls.sql's
-- reports clause) — not used as a general "is this an owner/PM" check
-- anywhere else that this would unintentionally affect.
--
-- Run this once against the live Supabase project (SQL editor), after
-- schema.sql and 02_project_scoping_rls.sql have already been applied.
-- Idempotent — create or replace, safe to re-run.
-- ============================================================================

create or replace function public.gr_is_owner_or_pm()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select gr_current_role_code() in ('owner', 'projects', 'field_pic')
$$;
