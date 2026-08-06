-- ---------------------------------------------------------------------------
-- XA DOS — Glass Railing Installation Monitoring
-- Schema for the SAME XA DOS Supabase project, isolated to gr_-prefixed
-- tables. Run this against the real project (once rebuilt — see
-- xa_dos_migrations/README_RUN_ORDER.md) — it does not touch, rename, or
-- drop any existing XA DOS table.
--
-- IMPORTANT — this schema was corrected after reading the real project's
-- actual foundation schema (xa_dos_migrations/00_foundation_schema.sql and
-- 03_seed_data.sql), not written against invented assumptions:
--
--   1. The real system has exactly 12 fixed, role-based logins (app_users,
--      one per role_code: owner, admin, finance, hrd, purchasing, warehouse,
--      estimating, projects, fieldops, docs, reports, employee) — never
--      per-person. There is NO 'Installer', 'Site Engineer', 'Project
--      Coordinator', or 'QC Inspector' role anywhere in the real database.
--      Those four field-crew distinctions exist only inside this glass-
--      railing app's own UI/mock layer (the role switcher), not as a real
--      security boundary.
--   2. The real access-control model is explicitly NOT role-name-string
--      based — the foundation schema's own comment states it as a locked
--      decision: "application code must never parse this string [role_code]
--      to determine permissions." Access is governed by
--      role_module_permissions (a role_id -> module_id -> permission_level
--      matrix) via the existing has_module_access(module_code, min_level)
--      function.
--   3. Decision (confirmed with the project owner): collapse all four
--      field-crew UI roles onto the real 'field_ops' module permission
--      check, using has_module_access() exactly like every other XA DOS
--      module does. Owner and Project Manager (role_code 'projects') are
--      given explicit write/manage access below even though their locked
--      matrix entries are 'view'-only on field_ops — the glass-railing
--      app's UI routes them to Update Status / Kanban / QC screens, so
--      they need write access to this module specifically, layered on
--      top of the matrix rather than replacing it.
--   4. No real `projects` table exists yet in the XA DOS database (only a
--      placeholder project_id column with a "FK added once the Projects
--      module table exists" comment in the estimating schema) — so
--      gr_locations.project_code stays plain text, no FK, until that
--      table is actually built.
--   5. updated_by / uploaded_by / inspected_by / author columns stay plain
--      text for now rather than uuid FKs to auth.users(id). Every other
--      XA DOS table's created_by/updated_by is a uuid referencing
--      auth.users(id), which is the correct real convention — but this
--      app's service layer currently passes a display name string
--      (user.name), not auth.uid(). Switching these to real FKs requires
--      an app-layer change (pass auth.uid(), join to employees/app_users
--      for display) that hasn't happened yet — deferred, not forgotten.
-- ---------------------------------------------------------------------------

-- ---- Tables, mirroring src/types/index.ts exactly ----

create table if not exists gr_locations (
  id text primary key,                    -- e.g. 'GR-021'
  project_code text not null,             -- e.g. 'PR-001' -- no FK yet, real `projects` table doesn't exist (see note 4 above)
  floor_level text not null,
  unit_no text not null,
  unit_type text not null check (unit_type in (
    'Studio', '1BR', '2BR', 'Front End Unit', 'Rear End Unit', 'Balcony Partition'
  )),
  total_linear_meters numeric(6,1) not null,
  total_glass_panels integer not null,
  bracket_system text not null check (bracket_system in (
    'Bracket System A', 'Bracket System B', 'Bracket System C'
  )),
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  assigned_team text not null check (assigned_team in ('Team A', 'Team B', 'Team C', 'Team D')),
  status text not null check (status in (
    'Not Started', 'In Progress', 'QC Inspection', 'Punch List', 'On Hold', 'Completed'
  )),
  remarks text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gr_locations_project on gr_locations (project_code);
create index if not exists idx_gr_locations_floor on gr_locations (project_code, floor_level);
create index if not exists idx_gr_locations_status on gr_locations (project_code, status);

-- One row per checklist stage per location (10 stages x N locations).
create table if not exists gr_installation_updates (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references gr_locations(id) on delete cascade,
  stage text not null check (stage in (
    'areaReleased', 'bracketInstalled', 'glassDelivered', 'glassInstalled',
    'alignmentChecked', 'handrailInstalled', 'accessoriesCompleted',
    'sealantCompleted', 'finalInspection', 'completed'
  )),
  is_completed boolean not null default false,
  updated_at timestamptz,
  updated_by text,                        -- no FK yet (see note 5 above)
  remark text default '',
  unique (location_id, stage)
);
create index if not exists idx_gr_installation_updates_location on gr_installation_updates (location_id);

create table if not exists gr_photos (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references gr_locations(id) on delete cascade,
  category text not null check (category in ('Before', 'During', 'After', 'Punch List')),
  storage_path text not null,             -- e.g. 'PR-001/GR-021/<uuid>.jpg' in the glass-railing-photos bucket
  file_name text not null,
  uploaded_by text,                       -- no FK yet (see note 5 above)
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_gr_photos_location on gr_photos (location_id, category);

create table if not exists gr_qc_inspections (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references gr_locations(id) on delete cascade,
  result text check (result in ('Passed', 'Failed')),
  item_results jsonb not null default '{}'::jsonb,  -- { [checklistItemKey]: boolean }
  issue_description text,
  priority text check (priority in ('High', 'Medium', 'Low')),
  photo_attached boolean default false,
  inspected_by text,                      -- no FK yet (see note 5 above)
  inspected_at timestamptz not null default now()
);
create index if not exists idx_gr_qc_inspections_location on gr_qc_inspections (location_id);

create table if not exists gr_punch_items (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references gr_locations(id) on delete cascade,
  issue_description text not null,
  category text not null,
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  assigned_team text not null check (assigned_team in ('Team A', 'Team B', 'Team C', 'Team D')),
  status text not null default 'Open' check (status in (
    'Open', 'Assigned', 'In Rectification', 'For Verification', 'Closed'
  )),
  date_found date not null default current_date,
  target_completion_date date,
  rectification_notes text default '',
  qc_verification text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gr_punch_items_location on gr_punch_items (location_id);
create index if not exists idx_gr_punch_items_status on gr_punch_items (location_id, status);

create table if not exists gr_comments (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references gr_locations(id) on delete cascade,
  author text not null,                   -- no FK yet (see note 5 above)
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_gr_comments_location on gr_comments (location_id, created_at desc);

-- Timeline / audit trail. Written by services on every status-changing
-- action (QC submit, punch-list resolution, manual status update, etc).
create table if not exists gr_activity_logs (
  id uuid primary key default gen_random_uuid(),
  location_id text not null references gr_locations(id) on delete cascade,
  occurred_on date not null default current_date,
  occurred_at_time text not null,         -- 'HH:MM', matches app's display format
  user_name text not null,
  action text not null,
  remarks text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_gr_activity_logs_location on gr_activity_logs (location_id, occurred_on, occurred_at_time);

-- ---------------------------------------------------------------------------
-- Row Level Security — built on the REAL XA DOS permission system
-- (has_module_access(), roles, app_users — from 00_foundation_schema.sql),
-- not on a role-name string. See notes 1-3 above for why.
-- ---------------------------------------------------------------------------

-- The logged-in app_user's role_code (e.g. 'fieldops', 'owner', 'projects').
-- Mirrors the real system's own current_role_id()/current_department_id()
-- helper-function pattern.
create or replace function gr_current_role_code() returns text
language sql stable security definer
as $$
  select r.role_code
  from app_users au
  join roles r on r.id = au.role_id
  where au.id = auth.uid()
$$;

-- Read: anyone with at least 'view' on the real field_ops module.
-- Matches has_module_access('field_ops','view') for: owner, warehouse,
-- projects, fieldops, reports. Excludes admin, finance, hrd, purchasing,
-- estimating, docs, employee(*) — (*) employee actually has 'edit', so is
-- included too; see has_module_access's own level semantics.
create or replace function gr_can_read() returns boolean
language sql stable security definer
as $$
  select has_module_access('field_ops', 'view')
$$;

-- Write: real field_ops 'edit'+ access (fieldops, employee), OR Owner /
-- Project Manager explicitly (their matrix entry is 'view'-only, but the
-- glass-railing app's UI routes them to Update Status / Kanban, which need
-- write access to this module specifically — see note 3 above).
create or replace function gr_can_write() returns boolean
language sql stable security definer
as $$
  select has_module_access('field_ops', 'edit') or gr_current_role_code() in ('owner', 'projects')
$$;

-- Manage: privileged actions (submitting a QC inspection, creating/deleting
-- a location record). Real field_ops 'full' access (fieldops only), OR
-- Owner / Project Manager explicitly, same reasoning as gr_can_write().
create or replace function gr_can_manage() returns boolean
language sql stable security definer
as $$
  select has_module_access('field_ops', 'full') or gr_current_role_code() in ('owner', 'projects')
$$;

alter table gr_locations enable row level security;
alter table gr_installation_updates enable row level security;
alter table gr_photos enable row level security;
alter table gr_qc_inspections enable row level security;
alter table gr_punch_items enable row level security;
alter table gr_comments enable row level security;
alter table gr_activity_logs enable row level security;

-- gr_locations: field_ops-readable users can read; write access can update
-- (matches the app's Update Status screen); only manage-level (fieldops
-- supervisor / Owner / PM) can create/delete a location record (bulk
-- import / admin task, not a normal field action from any screen).
drop policy if exists "gr_locations_select" on gr_locations;
create policy "gr_locations_select" on gr_locations
  for select using (gr_can_read());
drop policy if exists "gr_locations_update" on gr_locations;
create policy "gr_locations_update" on gr_locations
  for update using (gr_can_write())
  with check (gr_can_write());
drop policy if exists "gr_locations_insert" on gr_locations;
create policy "gr_locations_insert" on gr_locations
  for insert with check (gr_can_manage());
drop policy if exists "gr_locations_delete" on gr_locations;
create policy "gr_locations_delete" on gr_locations
  for delete using (gr_can_manage());

-- gr_installation_updates (checklist): read = gr_can_read(), write = gr_can_write().
drop policy if exists "gr_installation_updates_all" on gr_installation_updates;
drop policy if exists "gr_installation_updates_select" on gr_installation_updates;
create policy "gr_installation_updates_select" on gr_installation_updates
  for select using (gr_can_read());
drop policy if exists "gr_installation_updates_insert" on gr_installation_updates;
create policy "gr_installation_updates_insert" on gr_installation_updates
  for insert with check (gr_can_write());
drop policy if exists "gr_installation_updates_update" on gr_installation_updates;
create policy "gr_installation_updates_update" on gr_installation_updates
  for update using (gr_can_write())
  with check (gr_can_write());

-- gr_photos: read = gr_can_read(), add/remove = gr_can_write() (matches
-- the Photos screen's add + remove actions).
drop policy if exists "gr_photos_all" on gr_photos;
drop policy if exists "gr_photos_select" on gr_photos;
create policy "gr_photos_select" on gr_photos
  for select using (gr_can_read());
drop policy if exists "gr_photos_insert" on gr_photos;
create policy "gr_photos_insert" on gr_photos
  for insert with check (gr_can_write());
drop policy if exists "gr_photos_delete" on gr_photos;
create policy "gr_photos_delete" on gr_photos
  for delete using (gr_can_write());

-- gr_qc_inspections: everyone with read access can see why a location is
-- in Punch List; only manage-level (fieldops supervisor / PM / Owner) can
-- create an inspection record. This is deliberately tighter than the
-- current mock UI (which doesn't route-gate the QC Inspection screen at
-- all) — RLS is the real security boundary; the UI route guard should
-- ideally be tightened to match once this is confirmed working.
drop policy if exists "gr_qc_inspections_select" on gr_qc_inspections;
create policy "gr_qc_inspections_select" on gr_qc_inspections
  for select using (gr_can_read());
drop policy if exists "gr_qc_inspections_insert" on gr_qc_inspections;
create policy "gr_qc_inspections_insert" on gr_qc_inspections
  for insert with check (gr_can_manage());

-- gr_punch_items: read = gr_can_read() (an installer needs to see what to
-- fix); status updates = gr_can_write() (matches the Punch List screen's
-- actual reachability — location-scoped for everyone, project-wide list
-- restricted at the route level, which is a UI convenience, not a data
-- boundary). Row creation is system-triggered from a QC failure, not a
-- direct user action, so it's restricted the same as gr_qc_inspections.
drop policy if exists "gr_punch_items_select" on gr_punch_items;
create policy "gr_punch_items_select" on gr_punch_items
  for select using (gr_can_read());
drop policy if exists "gr_punch_items_update" on gr_punch_items;
create policy "gr_punch_items_update" on gr_punch_items
  for update using (gr_can_write())
  with check (gr_can_write());
drop policy if exists "gr_punch_items_insert" on gr_punch_items;
create policy "gr_punch_items_insert" on gr_punch_items
  for insert with check (gr_can_manage());

-- gr_comments: read = gr_can_read(), post = gr_can_write() — matches Notes & Comments.
drop policy if exists "gr_comments_all" on gr_comments;
drop policy if exists "gr_comments_select" on gr_comments;
create policy "gr_comments_select" on gr_comments
  for select using (gr_can_read());
drop policy if exists "gr_comments_insert" on gr_comments;
create policy "gr_comments_insert" on gr_comments
  for insert with check (gr_can_write());

-- gr_activity_logs: read = gr_can_read(); inserted by the service layer on
-- behalf of whichever role performed the triggering action, so insert
-- requires the same write access as the action that triggered it — but
-- never updated or deleted, preserving history.
drop policy if exists "gr_activity_logs_select" on gr_activity_logs;
create policy "gr_activity_logs_select" on gr_activity_logs
  for select using (gr_can_read());
drop policy if exists "gr_activity_logs_insert" on gr_activity_logs;
create policy "gr_activity_logs_insert" on gr_activity_logs
  for insert with check (gr_can_write());

-- ---------------------------------------------------------------------------
-- Storage bucket (run separately in the Supabase dashboard or via the
-- Storage API — SQL alone can't create buckets on most Supabase versions).
--
-- Bucket name: glass-railing-photos
-- Path convention: {project_code}/{location_id}/{uuid}.{ext}
--   e.g. glass-railing-photos/PR-001/GR-021/8f2c1e.jpg
-- Keep it private; serve via signed URLs from the photoService, not public
-- URLs, since field photos may be commercially sensitive.
-- ---------------------------------------------------------------------------
