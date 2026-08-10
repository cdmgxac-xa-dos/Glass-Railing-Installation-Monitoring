-- ---------------------------------------------------------------------------
-- Phase 1 of the Field Installation Monitoring expansion (owner's v1.2 plan,
-- 2026-08-10): foundation only. Adds the ability for a location to belong
-- to an installation scope (Glass Railings today, Doors & Windows next) and
-- for checklists/QC to be looked up from a template instead of a hardcoded
-- list — but does NOT change any existing behavior yet.
--
-- Zero visible effect: every existing gr_locations row is tagged 'RAILING'
-- by the column default, the seeded RAILING templates below reproduce the
-- exact stage/item lists already hardcoded in src/types/index.ts
-- (CHECKLIST_STAGES / QC_CHECKLIST_ITEMS), and no application code reads
-- these new tables yet. This file only adds; it never renames, drops, or
-- alters an existing column's meaning.
-- ---------------------------------------------------------------------------

create table if not exists installation_scopes (
  code text primary key,              -- 'RAILING', 'DOORS_WINDOWS', ...
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into installation_scopes (code, name, sort_order) values
  ('RAILING', 'Glass Railings', 1),
  ('DOORS_WINDOWS', 'Doors & Windows', 2)
on conflict (code) do nothing;

alter table gr_locations
  add column if not exists scope text not null default 'RAILING'
  references installation_scopes(code);

create index if not exists idx_gr_locations_scope on gr_locations (project_code, scope);

-- One row per scope, holding its ordered checklist stages as jsonb — same
-- { key, label } shape as the current CHECKLIST_STAGES constant, so the
-- app-side change (Phase 3) is "load this instead of the hardcoded array",
-- not a data reshape.
create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  scope text not null references installation_scopes(code),
  name text not null,
  stages jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope)
);

insert into checklist_templates (scope, name, stages) values (
  'RAILING',
  'Glass Railing Installation Checklist',
  '[
    {"key": "areaReleased", "label": "Area Released"},
    {"key": "bracketInstalled", "label": "Bracket Installed"},
    {"key": "glassDelivered", "label": "Glass Delivered to Location"},
    {"key": "glassInstalled", "label": "Glass Installed"},
    {"key": "alignmentChecked", "label": "Alignment Checked"},
    {"key": "handrailInstalled", "label": "Handrail or Top Cap Installed"},
    {"key": "accessoriesCompleted", "label": "Accessories Completed"},
    {"key": "sealantCompleted", "label": "Sealant or Grouting Completed"},
    {"key": "finalInspection", "label": "Final Inspection"},
    {"key": "completed", "label": "Completed"}
  ]'::jsonb
) on conflict (scope) do nothing;

-- Same idea for QC: one row per scope, holding its ordered QC checklist
-- items, mirroring the current QC_CHECKLIST_ITEMS constant.
create table if not exists qc_templates (
  id uuid primary key default gen_random_uuid(),
  scope text not null references installation_scopes(code),
  name text not null,
  items jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope)
);

insert into qc_templates (scope, name, items) values (
  'RAILING',
  'Glass Railing QC Checklist',
  '[
    {"key": "panelCondition", "label": "Glass panel condition"},
    {"key": "gapConsistency", "label": "Panel gap consistency"},
    {"key": "verticalAlignment", "label": "Vertical alignment"},
    {"key": "topAlignment", "label": "Top alignment"},
    {"key": "bracketSpacing", "label": "Bracket spacing"},
    {"key": "anchorCompletion", "label": "Anchor completion"},
    {"key": "handrailJoint", "label": "Handrail joint condition"},
    {"key": "sealantQuality", "label": "Sealant quality"},
    {"key": "scratchesChips", "label": "Glass scratches or chips"},
    {"key": "stabilityMovement", "label": "Stability or movement"},
    {"key": "missingAccessories", "label": "Missing accessories"}
  ]'::jsonb
) on conflict (scope) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — same access model as every other gr_* table (see schema.sql):
-- read = gr_can_read(), write/manage = gr_can_manage(). These are reference
--/config tables (which stages exist, in what order), not day-to-day field
-- data, so ordinary field_ops write access does not get edit rights here —
-- only fieldops supervisor / Owner / PM, same tier gr_locations insert/delete
-- already requires.
-- ---------------------------------------------------------------------------

alter table installation_scopes enable row level security;
alter table checklist_templates enable row level security;
alter table qc_templates enable row level security;

drop policy if exists "installation_scopes_select" on installation_scopes;
create policy "installation_scopes_select" on installation_scopes
  for select using (gr_can_read());
drop policy if exists "installation_scopes_manage" on installation_scopes;
create policy "installation_scopes_manage" on installation_scopes
  for all using (gr_can_manage()) with check (gr_can_manage());

drop policy if exists "checklist_templates_select" on checklist_templates;
create policy "checklist_templates_select" on checklist_templates
  for select using (gr_can_read());
drop policy if exists "checklist_templates_manage" on checklist_templates;
create policy "checklist_templates_manage" on checklist_templates
  for all using (gr_can_manage()) with check (gr_can_manage());

drop policy if exists "qc_templates_select" on qc_templates;
create policy "qc_templates_select" on qc_templates
  for select using (gr_can_read());
drop policy if exists "qc_templates_manage" on qc_templates;
create policy "qc_templates_manage" on qc_templates
  for all using (gr_can_manage()) with check (gr_can_manage());
