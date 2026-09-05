# CLAUDE.md — working notes for this repo

Context for picking this project back up in a future session. See
`README.md` for the original setup instructions — but read the caveat
about it below before trusting it. This file is decisions, gotchas, and
current architecture, reconstructed from git history and code comments
(there was no CLAUDE.md here before this one).

## What this is

A standalone, mobile-first field-monitoring web app, deployed on Netlify
at **https://xa-dosfieldmonitoring.netlify.app** (Netlify project
`xa-dosfieldmonitoring`, site id `c0651987-cadb-40af-ba40-9853a690d2f2`,
under the user's own "guangdongxinhe's team"). It shares the same **XA
DOS** Supabase project as its backend as the other XA DOS module apps
(`xa-gantt-scheduling` calls this project `tdzkwclfthmvofegacji`) —
different frontend, same database.

Originally built (and still named, at the repo/package/GitHub level) as
**Glass Railing Installation Monitoring** — tracking glass railing
installs floor-by-floor, bracket to sign-off. The user later expanded its
scope to also cover **Doors & Windows** installation on the same projects,
and the UI/branding was updated to the more general **"XA-DOS Field
Monitoring"** name (browser title, PWA manifest, splash/login screens) —
see the "Multi-scope expansion" and "Rebrand" sections below. The
underlying repo name, `package.json` name (`xa-dos-glass-railing`), and
`gr_`-prefixed table names were all kept as-is rather than renamed, so
"glass railing" still appears throughout the codebase even though the app
covers more than that now.

**README.md is stale — do not trust its "Data & backend" section.** It
was written for the very first sandboxed generation of this app ("no
network access, everything is mock data, Supabase configured but not
wired"). That was true on day one; it has not been true for most of this
repo's history. Real Supabase Auth, real dual-mode services, the
multi-scope expansion, PDF reports, floor-plan pins, and PWA install
support were all added since, and none of it is reflected in the README.
Trust this file and the code over it.

## Architecture: dual-mode services

Every service in `src/services/` follows the same pattern: check
`isSupabaseConfigured` (from `src/lib/supabaseClient.ts`, true when
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set) and branch between an
in-memory mock store/mock data (`src/data/mockData.ts`) and real Supabase
queries. Pages never know which mode they're in — they only call the
service layer. This means local dev works fully with zero credentials
(`npm run dev` with no `.env.local`), which is deliberate. When adding a
new service or extending an existing one, keep both branches working;
don't let one silently bit-rot (the README's staleness above is exactly
that happening at the doc level — don't let it happen in code).

The dev-only floating **role switcher** (bottom-right, mock mode only)
lets you preview all 5 `UserRole`s instantly without logging out.
`getUserForRole()` in `authService.ts` throws in real mode — switching the
*displayed* role without switching the actual authenticated Supabase
session would desync the UI from real RLS permissions underneath, which is
a security-relevant bug, not a harmless preview.

## This app touches more than `gr_*` — unlike `xa-gantt-scheduling`

`xa-gantt-scheduling`'s hard rule is "never touch anything outside
`gantt_*`". **This app is different and more deeply integrated**: besides
its own additive tables (`gr_locations`, `gr_installation_updates`,
`gr_photos`, `gr_qc_inspections`, `gr_punch_items`, `gr_comments`,
`gr_activity_logs`, `gr_report_history`, `gr_floor_plans`,
`gr_location_pins`, plus the non-`gr_`-prefixed but still additive
`installation_scopes`/`checklist_templates`/`qc_templates`), it directly
**reads XA DOS's own core tables** for auth and access control:
`auth.users`, `app_users`, `employees`, `roles`, `role_module_permissions`,
`projects`, `project_team_assignments`. See `supabase/schema.sql`'s header
comment and `supabase/02_project_scoping_rls.sql` for the reasoning this
was built against (they were written after reading XA DOS's actual
foundation schema, not invented assumptions). Concretely:

- **Auth is real Supabase Auth** (`signInWithPassword`), not magic links —
  different from `xa-gantt-scheduling`. Admin-created accounts get a
  temporary password and are forced through `/change-password` on first
  login (`must_change_password` flag, cleared server-side by the
  security-definer RPC `mark_password_changed()` — narrow, can only touch
  the calling user's own row).
- **Role mapping is a locked decision, not a display convenience.**
  `authService.ts`'s `ROLE_CODE_MAP` collapses XA DOS's real `role_code`
  values (`installer`, `qc_officer`, `field_pic`, `safety_officer`,
  `warehouseman`, `projects`, `owner`) onto this app's 5 `UserRole`
  values. Any real role_code *not* in that map — e.g. `admin`, `finance`,
  `employee` — is refused at login (throws) rather than defaulted to
  something plausible-looking, since a silent fallback here would be a
  real RLS/permission mismatch, not just a cosmetic bug. `'fieldops'` and
  `'foreman'` no longer exist as real role_codes at all (removed from XA
  DOS's roles table; Project Manager absorbed fieldops' former access
  tier) — `'Foreman'` is kept in the `UserRole` type only for the mock
  role-switcher's local preview, never produced by real login.
- **Access control is NOT role-name-string based.** XA DOS's own locked
  design decision (quoted in `schema.sql`) is that application code must
  never parse `role_code` to decide permissions — it goes through
  `has_module_access(module_code, min_level)` against the real
  `role_module_permissions` matrix, same as every other XA DOS module.
  This app's RLS layers Owner/Project Manager write access explicitly on
  top of their matrix entry (which is view-only on `field_ops`) because
  the UI routes them into write flows (Update Status, Kanban, QC) that
  need it — a deliberate exception, not a bypass of the model.
- **Project-level visibility is role-tiered**, added later in
  `02_project_scoping_rls.sql`: a fixed small set of project-scoped
  role_codes (`field_pic`, `safety_officer`, `qc_officer`, `installer`,
  `warehouseman`) only see projects they're rostered on, via
  `project_team_assignments`; every other (global) role sees all projects,
  unchanged. **Sequencing matters**: that migration must run only after
  the real `projects`/`project_team_assignments` tables exist *and* have
  actual roster rows entered — otherwise every project-scoped-tier user is
  silently locked out of everything, which is exactly the bug window the
  migration's own header comment warns about.
- `updated_by`/`uploaded_by`/`inspected_by`/`author` columns are plain
  text (a display name string), not `uuid` FKs to `auth.users` like every
  other XA DOS table — noted in `schema.sql` as deferred, not forgotten;
  switching requires passing `auth.uid()` from the service layer instead
  of `user.name`.

**Before any DDL against the shared project**: same collision-check
discipline as `xa-gantt-scheduling` — check for name collisions before
creating anything, and remember this app's migrations have a real
sequencing dependency on `xa_dos_migrations/*` (the main XA DOS repo) that
`xa-gantt-scheduling`'s don't.

## Multi-scope expansion (Railings → + Doors & Windows)

Phases 1–5 (commits `53746e1`…`adeff14`), moved this from a Railing-only
app to a generic "installation location" app:

- `supabase/05_scope_foundation.sql` added `gr_locations.scope`,
  `installation_scopes`, `checklist_templates`, `qc_templates`.
  `06_doors_windows_templates.sql` / `07_doors_windows_locations.sql` add
  the Doors & Windows-specific checklist/QC templates and location fields.
  `08_load_master_registers.sql` (~250KB) is a one-time data load of the
  real Spinnaker Doors & Windows register plus an updated Railing
  register — not something to re-run blindly.
- `RailingLocation` (`src/types/index.ts`) is, despite its name, now "one
  monitoring record for any scope" — Railing-specific fields
  (`totalLinearMeters`, `totalGlassPanels`, `bracketSystem`) and Doors &
  Windows-specific fields (`windowTag`, `windowSystem`, `towerBuilding`)
  are all optional on the same shape, not split into separate types.
- **ID scheme**: `id` is the DB primary key and must be globally unique
  across every project. Railing register IDs (e.g. `GR-021`) already are,
  so `id === reference` for those. Doors & Windows registers restart
  numbering per project (e.g. `AGD-001` on more than one project), so
  those get project-prefixed (e.g. `SPN-AGD-001`); the original register
  label is kept in `reference` for display — always prefer `reference`
  over `id` in UI, falling back to `id` only where `reference` is absent
  (mock data predates the field).
- **Data quality**: 86% of the real Spinnaker Windows register (464/539
  rows) has no unit number at all — this is a genuine gap in the source
  register, not something to fabricate. `unit_no` was made nullable after
  the first load failed on it (commit `0633f31`); every display site
  (`LocationCard`, `WorkCardPage`, `KanbanBoardPage`, `FloorPlanPage`,
  `reportPdfBuilder`) falls back to `windowTag` when `unitNo` is blank —
  keep that fallback if you touch any of those.
- Several "known values" types (`UnitType`, `BracketSystem`) are
  deliberately open unions with no matching DB constraint — real
  registers keep introducing new values (e.g. `'U-Channel'`), so an
  unlisted value still loads and displays fine rather than erroring.
  `ChecklistStageKey` is a plain `string` for the same kind of reason:
  which keys are valid depends on the location's scope — see
  `CHECKLIST_STAGES` vs `DOORS_WINDOWS_CHECKLIST_STAGES`.
- `ScopeSelectionPage` sits between project selection and the dashboard
  and auto-continues invisibly whenever a project has data for only one
  scope — true for every project today, so in practice nobody sees this
  screen yet. It exists for the day a project has both scopes' data.
- Floor plan pins needed a scope-filter fix (`0408e6c`, latest commit at
  time of writing) — Railing and Doors & Windows pins on the same
  floor-plan image were clashing before that; if you touch
  `floorPlanService.ts`/`FloorPlanPage.tsx`, check that scope filtering is
  still applied to both directions (fetching pins, and placing new ones).

## Rebrand

Commit `fb83781` changed the *displayed* name from "XA DOS / Glass Railing
Monitoring" to "XA-DOS / Field Monitoring" (browser title, PWA manifest,
OG/Twitter meta, Splash/Login/Change Password brand marks) using a new
favicon pack the project owner supplied. The repo name, package name, and
`gr_*` table prefix were deliberately left alone — only user-facing
strings and icon files changed.

**Known stale reference from that rebrand**: `index.html`'s
`twitter:image`/OG image meta still hardcodes
`https://glass-railing-installation-monitoring.netlify.app/og-image.png` —
the site's *old* Netlify subdomain. The live site today is actually
`xa-dosfieldmonitoring.netlify.app` (confirmed via the Netlify API this
session), so that link-preview image URL is dead. Worth fixing next time
you're in `index.html` — replace with the current domain.

## Other notable features

- **Floor plan pins** (`floorPlanService.ts`): upload a floor plan image
  per project+floor to the private `gr-floor-plans` Storage bucket (path
  `{project_code}/{floor_level}.{ext}`, unique constraint so a re-upload
  overwrites rather than orphaning the old file), place %-based pins
  linking image coordinates to locations, pinch-to-zoom/pan viewer
  (`react-zoom-pan-pinch`), signed URLs with an 8-hour TTL (matches
  `photoService`'s convention).
- **Photos**: compressed client-side before upload
  (`src/utils/imageCompression.ts`), two tiers stored — a ~400-600KB
  preview (detail views, PDF reports) and a ~50KB thumbnail (grid/list
  views) — added after the fact as a perf fix, so don't reintroduce a
  single-tier path.
- **Reports** (`reportService.ts` + `src/utils/reportPdfBuilder.ts`):
  on-demand PDF via `jspdf`/`jspdf-autotable` (not `@react-pdf/renderer`
  like `xa-gantt-scheduling` — different rendering approach entirely),
  configurable sections via `ReportConfig`, saved to the
  `glass-railing-reports` Storage bucket and logged in
  `gr_report_history`. An `isAutomatic` flag exists on report history rows
  — the UI path for actually triggering an automatic report wasn't
  reviewed in this pass, check before assuming it's wired end-to-end.
- **Activity feed** (`activityService.ts`): no dedicated events/audit-log
  table — entries are derived at query time from the `updated_at` /
  `created_at` / `inspected_at` / `uploaded_at` columns already on the
  various `gr_*` tables. Adding a new activity type means adding a new
  derivation, not a new table.
- **PWA install support**: `public/manifest.webmanifest` + `public/sw.js`.
  `netlify.toml` deliberately sets `no-cache` on `index.html`,
  `manifest.webmanifest`, and `sw.js` so installed/home-screen users
  always pick up new deploys instead of getting stuck on a cached shell,
  while hashed `/assets/*` files are cached forever (safe, since a new
  deploy always produces new filenames).

## Where things are

- `src/types/index.ts` — single source of truth for the domain model;
  read its inline comments before changing any field, several encode a
  real data-quality or scope-modeling decision (see above)
- `src/services/` — the dual-mode data access layer, one file per domain
  area (`locationService`, `checklistService`, `photoService`,
  `qcService`, `punchListService`, `commentService`, `timelineService`,
  `activityService`, `projectService`, `scopeService`, `templateService`,
  `floorPlanService`, `reportService`, `authService`)
- `src/utils/reportPdfBuilder.ts` — PDF report generation (jspdf)
- `src/pages/` — one file per screen; `App.tsx` has the full route map
  and role-gating (`ProtectedRoute` with `allowedRoles`/`allowedRoleCodes`)
- `supabase/schema.sql` — original schema + the header comment explaining
  how it was corrected against XA DOS's real foundation schema
- `supabase/02_project_scoping_rls.sql` — project-membership RLS layer,
  has a real sequencing dependency on the main XA DOS repo's migrations
- `supabase/05-07_*.sql` — multi-scope expansion (Doors & Windows)
- `supabase/08_load_master_registers.sql` — one-time real data load, large
- `.env.example` — `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; unset in
  local dev to run entirely on mock data
