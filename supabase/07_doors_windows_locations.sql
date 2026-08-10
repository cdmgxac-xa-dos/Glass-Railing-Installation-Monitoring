-- ---------------------------------------------------------------------------
-- Phase 5 of the Field Installation Monitoring expansion: schema changes
-- needed to load the real Doors & Windows master registers (Spinnaker,
-- TRAT) alongside the updated Spinnaker Railing register into gr_locations.
--
-- Four changes, all additive/loosening — nothing existing is dropped,
-- renamed, or made stricter:
--
--   1. `reference` — the human-facing label from the source register (e.g.
--      'GR-021', 'AGD-001'). `id` stays the DB primary key, which for
--      Doors & Windows rows is prefixed by project ('SPN-AGD-001',
--      'TRAT-AGD-001') because the Windows registers each restart their own
--      numbering at 'AGD-001' and gr_locations.id is one global primary
--      key, not scoped per project — 529 of those labels collide between
--      the two projects as originally numbered. `reference` is what field
--      crews see on screen; `id` is only used internally for routing and
--      joins. For Railing rows `reference` and `id` are the same value
--      (no collision risk there), so nothing changes for existing users.
--
--   2. `window_tag`, `window_system`, `tower_building` — new nullable
--      columns for fields the Windows registers track that Railings never
--      needed (frame/window tag, window system e.g. 'Punch Windows' /
--      'Curtain Wall' / 'Frameless Door', and which tower/building for
--      multi-tower projects like TRAT).
--
--   3. total_linear_meters / total_glass_panels / bracket_system /
--      priority / assigned_team all become nullable. The first three are
--      inherently Railing-only measurements — a window has no "linear
--      meters of railing". Priority and Assigned Team are blank on
--      essentially every row in all three source registers today (crews
--      haven't been dispatched to individual locations yet); the app now
--      shows "Unassigned" rather than requiring a value at import time.
--
--   4. Drops the bracket_system check constraint entirely, matching how
--      unit_type already works (see locationService.ts's existing
--      comments) — real registers keep introducing new material specs
--      (this batch added 'U-Channel'), and chasing that with a migration
--      every time doesn't scale. The known-values list in
--      src/types/index.ts (BRACKET_SYSTEMS) still seeds dropdowns; it's
--      just no longer enforced as a hard boundary at the database.
-- ---------------------------------------------------------------------------

alter table gr_locations
  add column if not exists reference text,
  add column if not exists window_tag text,
  add column if not exists window_system text,
  add column if not exists tower_building text;

-- Backfill existing rows (all Railing today) so `reference` is never null
-- going forward — mirrors `id` for every row that predates this column.
update gr_locations set reference = id where reference is null;

alter table gr_locations alter column reference set not null;

alter table gr_locations alter column total_linear_meters drop not null;
alter table gr_locations alter column total_glass_panels drop not null;
alter table gr_locations alter column bracket_system drop not null;
alter table gr_locations alter column priority drop not null;
alter table gr_locations alter column assigned_team drop not null;

-- Constraint name is Postgres's auto-generated default for an unnamed
-- inline check on this column (table_column_check) — using IF EXISTS in
-- case the live constraint was ever named differently.
alter table gr_locations drop constraint if exists gr_locations_bracket_system_check;

-- Unique per project, not globally — `reference` is exactly the label that
-- collides across projects (that's why `id` is prefixed instead), so a
-- global unique index here would be self-defeating. Within one project a
-- reference should still be unique.
create unique index if not exists idx_gr_locations_project_reference on gr_locations (project_code, reference);
