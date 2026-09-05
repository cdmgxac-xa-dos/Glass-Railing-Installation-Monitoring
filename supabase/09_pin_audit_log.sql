-- ---------------------------------------------------------------------------
-- Pin audit log (UI/UX Assessment P0-9): floor-plan pin positions are part
-- of a project's master spatial data, and gr_can_manage_pins() already
-- grants field_pic (Site PIC) edit access alongside qc_officer/projects
-- (verified live, see 09_pin_audit_log's note in schema.sql above this
-- feature). Rather than narrowing that access, every create/move/delete is
-- now recorded — old position, new position, who, and when — so a silent
-- pin move is never unaccountable.
--
-- pin_id is intentionally NOT a foreign key: a 'delete' entry must still be
-- readable after the gr_location_pins row it describes is gone.
-- ---------------------------------------------------------------------------

create table if not exists gr_pin_audit_log (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null,
  location_id text not null references gr_locations(id) on delete cascade,
  floor_plan_id uuid not null references gr_floor_plans(id) on delete cascade,
  action text not null check (action in ('create', 'move', 'delete')),
  old_x_pct numeric(6,5),
  old_y_pct numeric(6,5),
  new_x_pct numeric(6,5),
  new_y_pct numeric(6,5),
  changed_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gr_pin_audit_log_pin on gr_pin_audit_log (pin_id, created_at desc);
create index if not exists idx_gr_pin_audit_log_location on gr_pin_audit_log (location_id, created_at desc);

alter table gr_pin_audit_log enable row level security;

-- Append-only: readable by anyone with field_ops read access, insertable
-- only by whoever can manage pins in the first place. No update/delete
-- policy at all — an audit trail that can be edited or cleared isn't one.
drop policy if exists gr_pin_audit_log_select on gr_pin_audit_log;
create policy gr_pin_audit_log_select on gr_pin_audit_log
  for select using (gr_can_read());
drop policy if exists gr_pin_audit_log_insert on gr_pin_audit_log;
create policy gr_pin_audit_log_insert on gr_pin_audit_log
  for insert with check (gr_can_manage_pins());
