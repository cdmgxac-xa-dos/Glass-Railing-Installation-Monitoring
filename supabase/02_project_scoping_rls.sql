-- ============================================================================
-- GLASS RAILING — PROJECT-LEVEL SECURITY BOUNDARY
-- Run after schema.sql, AND after xa_dos_migrations/19_project_roster_and_scoping.sql
-- (needs the real `projects` / `project_team_assignments` tables to exist).
--
-- IMPORTANT SEQUENCING: run this only AFTER the project roster has real
-- assignments entered (who's on Spinnaker, who's on TRAT). Every
-- project-scoped role (field_pic, safety_officer, qc_officer, installer,
-- warehouseman) currently has field_ops access with NO project filter at
-- all -- any of them can read/write any project's photos, QC inspections,
-- punch lists, floor plans, and activity logs today. This migration closes
-- that gap by ANDing a project-membership check onto every existing
-- policy, without touching the existing role/module gating
-- (gr_can_read/write/manage/manage_pins, gr_is_owner_or_pm) at all.
--
-- Global roles (Owner, Project Manager/'projects', System Admin,
-- Purchasing, Purchasing & Finance Head, Warehouse dept head, Sales &
-- Marketing, Estimating, HR, Finance, Docs, Reports) are unaffected --
-- they see every project, same as before. Only the small, explicit list of
-- project-scoped role_codes below gets filtered.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Project-scoped role tier -- the fixed, small set of role_codes whose
-- visibility must be limited to projects they're rostered on. Everyone
-- else sees all projects (matches the client's stated "global" role list).
-- Add new role_codes to this list explicitly if a future role should be
-- project-scoped rather than global -- it does NOT infer this from
-- access_level, since e.g. Field Crew-tier roles could still be global
-- in principle.
-- ----------------------------------------------------------------------------
create or replace function gr_is_project_scoped_role() returns boolean
language sql stable security definer set search_path = public
as $$
  select gr_current_role_code() in (
    'field_pic', 'safety_officer', 'qc_officer', 'installer', 'warehouseman'
  )
$$;

-- Resolves whether the CURRENT user may see the given project_code.
-- Global-tier roles: always true. Project-scoped roles: true only if
-- project_team_assignments has a row for (this user, a project whose
-- project_code matches).
create or replace function gr_can_access_project(p_project_code text) returns boolean
language sql stable security definer set search_path = public
as $$
  select
    not gr_is_project_scoped_role()
    or exists (
      select 1
      from project_team_assignments pta
      join projects p on p.id = pta.project_id
      where pta.app_user_id = auth.uid()
        and p.project_code = p_project_code
    )
$$;

-- Resolves project_code indirectly for the 7 tables that only reference a
-- project via location_id -> gr_locations.project_code.
create or replace function gr_project_code_for_location(p_location_id text) returns text
language sql stable security definer set search_path = public
as $$
  select project_code from gr_locations where id = p_location_id
$$;

-- ----------------------------------------------------------------------------
-- gr_locations (direct project_code)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_locations_select" on gr_locations;
create policy "gr_locations_select" on gr_locations
  for select using (gr_can_read() and gr_can_access_project(project_code));
drop policy if exists "gr_locations_update" on gr_locations;
create policy "gr_locations_update" on gr_locations
  for update using (gr_can_write() and gr_can_access_project(project_code))
  with check (gr_can_write() and gr_can_access_project(project_code));
drop policy if exists "gr_locations_insert" on gr_locations;
create policy "gr_locations_insert" on gr_locations
  for insert with check (gr_can_manage() and gr_can_access_project(project_code));
drop policy if exists "gr_locations_delete" on gr_locations;
create policy "gr_locations_delete" on gr_locations
  for delete using (gr_can_manage() and gr_can_access_project(project_code));

-- ----------------------------------------------------------------------------
-- gr_installation_updates (indirect via location_id)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_installation_updates_select" on gr_installation_updates;
create policy "gr_installation_updates_select" on gr_installation_updates
  for select using (gr_can_read() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_installation_updates_insert" on gr_installation_updates;
create policy "gr_installation_updates_insert" on gr_installation_updates
  for insert with check (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_installation_updates_update" on gr_installation_updates;
create policy "gr_installation_updates_update" on gr_installation_updates
  for update using (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)))
  with check (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)));

-- ----------------------------------------------------------------------------
-- gr_photos (indirect via location_id)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_photos_select" on gr_photos;
create policy "gr_photos_select" on gr_photos
  for select using (gr_can_read() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_photos_insert" on gr_photos;
create policy "gr_photos_insert" on gr_photos
  for insert with check (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_photos_delete" on gr_photos;
create policy "gr_photos_delete" on gr_photos
  for delete using (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)));

-- ----------------------------------------------------------------------------
-- gr_qc_inspections (indirect via location_id)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_qc_inspections_select" on gr_qc_inspections;
create policy "gr_qc_inspections_select" on gr_qc_inspections
  for select using (gr_can_read() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_qc_inspections_insert" on gr_qc_inspections;
create policy "gr_qc_inspections_insert" on gr_qc_inspections
  for insert with check (gr_can_manage() and gr_can_access_project(gr_project_code_for_location(location_id)));

-- ----------------------------------------------------------------------------
-- gr_punch_items (indirect via location_id)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_punch_items_select" on gr_punch_items;
create policy "gr_punch_items_select" on gr_punch_items
  for select using (gr_can_read() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_punch_items_update" on gr_punch_items;
create policy "gr_punch_items_update" on gr_punch_items
  for update using (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)))
  with check (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_punch_items_insert" on gr_punch_items;
create policy "gr_punch_items_insert" on gr_punch_items
  for insert with check (gr_can_manage() and gr_can_access_project(gr_project_code_for_location(location_id)));

-- ----------------------------------------------------------------------------
-- gr_comments (indirect via location_id)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_comments_select" on gr_comments;
create policy "gr_comments_select" on gr_comments
  for select using (gr_can_read() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_comments_insert" on gr_comments;
create policy "gr_comments_insert" on gr_comments
  for insert with check (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)));

-- ----------------------------------------------------------------------------
-- gr_activity_logs (indirect via location_id)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_activity_logs_select" on gr_activity_logs;
create policy "gr_activity_logs_select" on gr_activity_logs
  for select using (gr_can_read() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists "gr_activity_logs_insert" on gr_activity_logs;
create policy "gr_activity_logs_insert" on gr_activity_logs
  for insert with check (gr_can_write() and gr_can_access_project(gr_project_code_for_location(location_id)));

-- ----------------------------------------------------------------------------
-- gr_report_history (direct project_code)
-- ----------------------------------------------------------------------------
drop policy if exists "gr_report_history_select" on gr_report_history;
create policy "gr_report_history_select" on gr_report_history
  for select using (gr_is_owner_or_pm() and gr_can_access_project(project_code));
drop policy if exists "gr_report_history_insert" on gr_report_history;
create policy "gr_report_history_insert" on gr_report_history
  for insert with check (gr_is_owner_or_pm() and gr_can_access_project(project_code));

-- ----------------------------------------------------------------------------
-- gr_floor_plans (direct project_code)
-- ----------------------------------------------------------------------------
drop policy if exists gr_floor_plans_select on gr_floor_plans;
create policy gr_floor_plans_select on gr_floor_plans
  for select using (gr_can_read() and gr_can_access_project(project_code));
drop policy if exists gr_floor_plans_insert on gr_floor_plans;
create policy gr_floor_plans_insert on gr_floor_plans
  for insert with check (gr_can_manage_pins() and gr_can_access_project(project_code));
drop policy if exists gr_floor_plans_update on gr_floor_plans;
create policy gr_floor_plans_update on gr_floor_plans
  for update using (gr_can_manage_pins() and gr_can_access_project(project_code)) with check (gr_can_manage_pins() and gr_can_access_project(project_code));
drop policy if exists gr_floor_plans_delete on gr_floor_plans;
create policy gr_floor_plans_delete on gr_floor_plans
  for delete using (gr_can_manage_pins() and gr_can_access_project(project_code));

-- ----------------------------------------------------------------------------
-- gr_location_pins (indirect via location_id)
-- ----------------------------------------------------------------------------
drop policy if exists gr_location_pins_select on gr_location_pins;
create policy gr_location_pins_select on gr_location_pins
  for select using (gr_can_read() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists gr_location_pins_insert on gr_location_pins;
create policy gr_location_pins_insert on gr_location_pins
  for insert with check (gr_can_manage_pins() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists gr_location_pins_update on gr_location_pins;
create policy gr_location_pins_update on gr_location_pins
  for update using (gr_can_manage_pins() and gr_can_access_project(gr_project_code_for_location(location_id))) with check (gr_can_manage_pins() and gr_can_access_project(gr_project_code_for_location(location_id)));
drop policy if exists gr_location_pins_delete on gr_location_pins;
create policy gr_location_pins_delete on gr_location_pins
  for delete using (gr_can_manage_pins() and gr_can_access_project(gr_project_code_for_location(location_id)));

-- ----------------------------------------------------------------------------
-- Project list visible to the current user -- used by the Glass Railing
-- app's projectService.ts to replace its hardcoded 2-project list.
-- security definer, same pattern as the existing get_my_field_projects().
-- ----------------------------------------------------------------------------
create or replace function gr_get_visible_projects()
returns table (id uuid, project_code text, name text, site_location text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.project_code, p.description as name, p.site_location
  from projects p
  where p.status = 'active'
    and (
      not gr_is_project_scoped_role()
      or exists (
        select 1 from project_team_assignments pta
        where pta.app_user_id = auth.uid() and pta.project_id = p.id
      )
    )
  order by p.created_at desc
$$;

-- ============================================================================
-- END -- KNOWN FOLLOW-UP, NOT INCLUDED HERE: the storage buckets
-- (glass-railing-reports, gr-floor-plans) have no path-level project check
-- today -- object paths embed project_code (e.g. 'PRJ-26070002/GR-021/...')
-- but no policy parses it out of storage.objects.name to enforce it. A
-- project-scoped user with any storage access could still construct a path
-- into another project's folder. Worth a fast follow-up once this table-
-- level fix is live and tested.
-- ============================================================================
