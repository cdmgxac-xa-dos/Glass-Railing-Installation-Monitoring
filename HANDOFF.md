# HANDOFF.md

Snapshot for picking up this project cold. `CLAUDE.md` has the full
architecture writeup, decisions, and gotchas; this file is the short
version. Don't trust `README.md`'s "Data & backend" section — see why in
CLAUDE.md.

## What this is

A standalone, mobile-first field-monitoring app deployed at
https://xa-dosfieldmonitoring.netlify.app (Netlify project
`xa-dosfieldmonitoring`, under the user's own Netlify team). It shares the
same XA DOS Supabase project as the other XA DOS module apps
(`xa-gantt-scheduling`, `xa-dos`) — different frontend, same database.

Repo/package name (`xa-dos-glass-railing`) and internal `gr_*` table
prefix still say "glass railing" because that's what it started as:
tracking glass railing installs floor-by-floor, bracket to sign-off. It
was later expanded to also cover **Doors & Windows** installation on the
same projects, and rebranded in the UI to **"XA-DOS Field Monitoring"** —
the old name only survives in the repo/package name and table prefix now.

## Current status

Live, actively developed — 36 commits, most recent one a scope-filtering
bugfix for floor-plan pins (Railings and Doors & Windows pins were
clashing on the same image). Real Supabase Auth is wired in (confirmed
live accounts with real sign-in history), not mock data — despite what
README.md says. No open/pending work is flagged in the history beyond the
one known stale reference below.

**Known stale reference to fix next time you're in `index.html`**: its
Twitter/OG image meta still points at the site's old Netlify subdomain
(`glass-railing-installation-monitoring.netlify.app`) instead of the
current one (`xa-dosfieldmonitoring.netlify.app`).

## Tech stack

React 18 + TypeScript + Vite, Tailwind CSS, React Router, Supabase JS
client, `jspdf`/`jspdf-autotable` for PDF reports (not
`@react-pdf/renderer`), Recharts for dashboard charts,
`react-zoom-pan-pinch` for the floor-plan pinch/zoom viewer. PWA-installable
(manifest + service worker). No test suite; `npm run lint` (ESLint) and
`tsc -b` (via `npm run build`) are the only automated checks.

## Setup

```bash
npm install
cp .env.example .env.local   # optional — omit to run entirely on mock data
npm run dev
```

Every service in `src/services/` is dual-mode: with no Supabase env vars
set, the whole app runs on in-memory mock data and mock auth (any
email/password, role inferred from email substring, dev-only role
switcher to preview all 5 roles). With real credentials, it talks to the
live XA DOS Supabase project via real Supabase Auth
(`signInWithPassword`) — no magic links here, unlike `xa-gantt-scheduling`.

## Where things are

- `src/types/index.ts` — the domain model; read its inline comments
  before touching any field, several encode real data-quality decisions
- `src/services/` — dual-mode data access layer, one file per domain area
- `src/utils/reportPdfBuilder.ts` — PDF report generation
- `src/pages/` + `src/App.tsx` — one file per screen; full route map and
  role-gating (`ProtectedRoute`) in `App.tsx`
- `supabase/schema.sql` — original schema (own `gr_*` tables)
- `supabase/02_project_scoping_rls.sql` — project-membership RLS,
  depends on the main XA DOS repo's migrations having run first
- `supabase/05-08_*.sql` — multi-scope (Doors & Windows) expansion +
  real master-register data load

## Things to know before touching this codebase

- **This app reads more than its own tables.** Unlike `xa-gantt-scheduling`
  (strictly `gantt_*`-only), this app's auth and access control directly
  read XA DOS's own core tables — `app_users`, `employees`, `roles`,
  `role_module_permissions`, `projects`, `project_team_assignments`. A
  schema change in the main XA DOS repo can break this app. See CLAUDE.md's
  "This app touches more than `gr_*`" section before assuming isolation.
- **Role mapping is a security boundary, not a display convenience.**
  `authService.ts`'s `ROLE_CODE_MAP` refuses login for any real role_code
  it doesn't recognize, rather than defaulting — don't "fix" that into a
  fallback.
- **Migration sequencing matters.** `02_project_scoping_rls.sql` must run
  only after the real `projects`/`project_team_assignments` tables exist
  with actual roster data, or every project-scoped-tier user gets silently
  locked out of everything.
- **Data has real gaps, don't paper over them.** 86% of the real Spinnaker
  Windows register has no unit number — that's a fact about the source
  register, not a bug; the UI's `windowTag` fallback is the fix, not a
  workaround to remove.

## Open items / natural next steps

Nothing specific is flagged as in-flight. The stale OG-image domain in
`index.html` is the one known loose end. `ScopeSelectionPage` (Railings vs
Doors & Windows picker) currently auto-continues invisibly on every
project since none yet has both scopes' data — revisit its visible UI
once a project actually does.
