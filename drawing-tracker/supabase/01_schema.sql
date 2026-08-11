-- =============================================================================
-- Client Shop Drawing Transparency Tracker — core schema
-- Standalone Supabase project (not part of XA DOS).
--
-- Run this file first, then 02_functions.sql, then 03_seed_register.sql, in
-- the Supabase SQL Editor (or `supabase db push` if you keep these as
-- migrations). Safe to re-run: everything is guarded with IF NOT EXISTS /
-- CREATE OR REPLACE.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type app_role as enum ('xa_admin', 'draftsman', 'daaa', 'gpi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type drawing_status as enum (
    'not_started',
    'assigned',
    'drafting',
    'internal_review',
    'submitted_to_daaa',
    'daaa_review',
    'gpi_review',
    'approved',
    'revision_required',
    'completed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_action as enum (
    'created',
    'assigned',
    'started_drafting',
    'uploaded_pdf',
    'marked_complete',
    'returned_to_draftsman',
    'submitted_to_daaa',
    'daaa_started_review',
    'daaa_approved',
    'daaa_revision_requested',
    'gpi_started_review',
    'gpi_approved',
    'gpi_revision_requested',
    'gpi_rejected',
    'revision_reassigned',
    'marked_completed',
    'edited',
    'deleted',
    'remark_added'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles — one row per app user, 1:1 with auth.users
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role app_role not null,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- drawing_items — the drawing register (preloaded from the client's Excel)
-- ---------------------------------------------------------------------------

create table if not exists drawing_items (
  id uuid primary key default gen_random_uuid(),
  item_no text not null unique,
  description text not null,
  category text,
  sheet_no text,
  reference text,
  unit text,
  qty numeric,
  plan_reference text,
  target_submission_date date,
  assigned_draftsman uuid references profiles (id) on delete set null,
  status drawing_status not null default 'not_started',
  submission_date date,
  approval_date date,
  remarks text,
  revision_number integer not null default 0,
  current_pdf_id uuid, -- FK added below, after drawing_pdfs exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drawing_items_status on drawing_items (status);
create index if not exists idx_drawing_items_assigned on drawing_items (assigned_draftsman);

-- ---------------------------------------------------------------------------
-- drawing_pdfs — every uploaded revision, immutable once created
-- ---------------------------------------------------------------------------

create table if not exists drawing_pdfs (
  id uuid primary key default gen_random_uuid(),
  drawing_item_id uuid not null references drawing_items (id) on delete cascade,
  revision_number integer not null,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references profiles (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  is_current boolean not null default true
);

create index if not exists idx_drawing_pdfs_item on drawing_pdfs (drawing_item_id);

do $$ begin
  alter table drawing_items
    add constraint fk_drawing_items_current_pdf
    foreign key (current_pdf_id) references drawing_pdfs (id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- review_history — full audit trail (submission/approval/revision timeline)
-- ---------------------------------------------------------------------------

create table if not exists review_history (
  id uuid primary key default gen_random_uuid(),
  drawing_item_id uuid not null references drawing_items (id) on delete cascade,
  date timestamptz not null default now(),
  user_id uuid references profiles (id) on delete set null,
  role app_role,
  action review_action not null,
  comments text
);

create index if not exists idx_review_history_item on review_history (drawing_item_id, date);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_drawing_items_touch on drawing_items;
create trigger trg_drawing_items_touch
  before update on drawing_items
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- current_role() — SECURITY DEFINER helper so RLS policies can check the
-- caller's role without re-triggering RLS on profiles (avoids recursion).
-- ---------------------------------------------------------------------------

create or replace function current_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_authenticated() returns boolean
language sql stable as $$
  select auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table drawing_items enable row level security;
alter table drawing_pdfs enable row level security;
alter table review_history enable row level security;

-- profiles ---------------------------------------------------------------

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_insert_xa_admin on profiles;
create policy profiles_insert_xa_admin on profiles
  for insert to authenticated
  with check (current_role() = 'xa_admin');

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_update_xa_admin on profiles;
create policy profiles_update_xa_admin on profiles
  for update to authenticated
  using (current_role() = 'xa_admin')
  with check (current_role() = 'xa_admin');

drop policy if exists profiles_delete_xa_admin on profiles;
create policy profiles_delete_xa_admin on profiles
  for delete to authenticated
  using (current_role() = 'xa_admin');

-- drawing_items ------------------------------------------------------------
-- All mutation for non-admin roles happens through SECURITY DEFINER RPCs in
-- 02_functions.sql, which validate the workflow rules the raw RLS policies
-- below cannot express (e.g. "DAAA may only act on items already submitted
-- to DAAA"). Direct table writes are restricted to xa_admin.

drop policy if exists drawing_items_select on drawing_items;
create policy drawing_items_select on drawing_items
  for select to authenticated
  using (true);

drop policy if exists drawing_items_insert_xa on drawing_items;
create policy drawing_items_insert_xa on drawing_items
  for insert to authenticated
  with check (current_role() = 'xa_admin');

drop policy if exists drawing_items_update_xa on drawing_items;
create policy drawing_items_update_xa on drawing_items
  for update to authenticated
  using (current_role() = 'xa_admin')
  with check (current_role() = 'xa_admin');

drop policy if exists drawing_items_delete_xa on drawing_items;
create policy drawing_items_delete_xa on drawing_items
  for delete to authenticated
  using (current_role() = 'xa_admin');

-- drawing_pdfs ---------------------------------------------------------------
-- No client-side INSERT/UPDATE/DELETE policies at all: every row is created
-- exclusively by the xa_upload_pdf / draftsman_upload_pdf RPCs (SECURITY
-- DEFINER), which keeps the revision trail tamper-proof.

drop policy if exists drawing_pdfs_select on drawing_pdfs;
create policy drawing_pdfs_select on drawing_pdfs
  for select to authenticated
  using (true);

-- review_history ---------------------------------------------------------
-- Same story: append-only audit log, written only by RPCs.

drop policy if exists review_history_select on review_history;
create policy review_history_select on review_history
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Public (anon) read access for the Client Transparency Dashboard.
-- Exposes progress/status/dates but never raw table internals — and only
-- links to approved/completed PDFs, never work-in-progress drawings.
-- ---------------------------------------------------------------------------

create or replace view client_dashboard_view as
select
  di.id,
  di.item_no,
  di.description,
  di.category,
  di.unit,
  di.qty,
  di.target_submission_date,
  di.status,
  di.submission_date,
  di.approval_date,
  di.revision_number
from drawing_items di;

grant select on client_dashboard_view to anon, authenticated;

create or replace view client_dashboard_pdfs as
select
  dp.drawing_item_id,
  dp.revision_number,
  dp.storage_path,
  dp.file_name,
  dp.uploaded_at
from drawing_pdfs dp
join drawing_items di on di.id = dp.drawing_item_id
where dp.is_current = true
  and di.status in ('approved', 'completed');

grant select on client_dashboard_pdfs to anon, authenticated;

-- Internal free-form remarks (action = 'remark_added') are excluded from the
-- public feed — the client sees that formal workflow events happened
-- (submitted, reviewed, revision requested, approved) with their comments,
-- but not day-to-day internal back-and-forth between XA/draftsman/reviewers.
create or replace view client_dashboard_timeline as
select
  rh.drawing_item_id,
  rh.date,
  rh.action,
  case when rh.action = 'remark_added' then null else rh.comments end as comments,
  rh.role
from review_history rh
where rh.action <> 'remark_added';

grant select on client_dashboard_timeline to anon, authenticated;

-- Directory used by the pre-login screen to list selectable, passwordless
-- accounts (Draftsman / DAAA / GPI) without ever exposing emails publicly.
create or replace view public_login_directory as
select id, full_name, role
from profiles
where role <> 'xa_admin';

grant select on public_login_directory to anon;

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded PDF drawings (private; served via signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('drawing-pdfs', 'drawing-pdfs', false)
on conflict (id) do nothing;

drop policy if exists drawing_pdfs_storage_select on storage.objects;
create policy drawing_pdfs_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'drawing-pdfs');

drop policy if exists drawing_pdfs_storage_insert on storage.objects;
create policy drawing_pdfs_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'drawing-pdfs'
    and current_role() in ('xa_admin', 'draftsman')
  );

drop policy if exists drawing_pdfs_storage_update on storage.objects;
create policy drawing_pdfs_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'drawing-pdfs' and current_role() = 'xa_admin');

drop policy if exists drawing_pdfs_storage_delete on storage.objects;
create policy drawing_pdfs_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'drawing-pdfs' and current_role() = 'xa_admin');

-- Anonymous read access, but only for the current PDF of an approved/
-- completed drawing — matches the Client Transparency Dashboard's
-- "Approved documents" feature and nothing else.
--
-- This has to go through a SECURITY DEFINER function rather than a plain
-- subquery: anon has no RLS access to drawing_pdfs/drawing_items at all
-- (both tables only grant SELECT to `authenticated`), so a bare `exists
-- (select ... from drawing_pdfs ...)` evaluated as anon would always see
-- zero rows and this policy would silently never match anything.
create or replace function pdf_is_publicly_approved(p_storage_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from drawing_pdfs dp
    join drawing_items di on di.id = dp.drawing_item_id
    where dp.storage_path = p_storage_path
      and dp.is_current = true
      and di.status in ('approved', 'completed')
  );
$$;

grant execute on function pdf_is_publicly_approved(text) to anon, authenticated;

drop policy if exists drawing_pdfs_storage_select_public on storage.objects;
create policy drawing_pdfs_storage_select_public on storage.objects
  for select to anon
  using (bucket_id = 'drawing-pdfs' and pdf_is_publicly_approved(storage.objects.name));
