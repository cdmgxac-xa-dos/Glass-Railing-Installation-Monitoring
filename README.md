# XA DOS — Glass Railing Installation Monitoring

A standalone, mobile-first web app for tracking glass railing installation
progress in the field — separate from the existing XA DOS Windows
Monitoring module, so the two can be A/B tested on site.

## Tech stack

React 18 + Vite + TypeScript + Tailwind CSS + React Router + Supabase JS
client (configured, not yet wired to live data) + Lucide React icons +
Recharts (dashboard charts only).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase creds later — optional for now
npm run dev
```

Open the printed local URL on your phone (same Wi-Fi) or in a mobile
device-emulated browser tab — the layout is designed mobile-first at
~390–430px wide, and is responsive up to desktop for management users.

> **Note on this build:** this project was generated in a sandboxed
> environment with no network access, so `npm install` / `npm run dev`
> could not be executed here to produce a live proof-of-run. Every file was
> written by hand against the exact package versions pinned in
> `package.json`, using standard, well-established APIs for each library
> (React Router v6, Tailwind v3, Recharts v2, lucide-react, Supabase JS v2).
> Please run `npm install && npm run dev` locally and let me know if
> anything doesn't compile — I'll fix it immediately.

## Mock login

Any email/password combination works. Include one of these words in the
email to preview a specific role, otherwise it defaults to Project Manager:

- `installer@...` → Installer
- `foreman@...` → Foreman
- `qc@...` → QC Inspector
- `owner@...` → Owner
- anything else → Project Manager

In dev mode, a floating role-switcher button (bottom-right) lets you jump
between all five roles instantly without logging out.

## Data & backend

All data currently comes from `src/data/mockData.ts` (30 sample railing
locations for **PR-001 — The Spinnaker @ Club Laiya**, IDs `GR-001`–`GR-030`).
Every read/write goes through the **service layer** in `src/services/`
(`locationService`, `checklistService`, `photoService`, `qcService`,
`punchListService`, `timelineService`, `projectService`, `authService`).

To connect the real XA DOS Supabase project:

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
2. Inside each service, replace the in-memory array reads/writes with
   `supabase.from('...').select()/insert()/update()` calls, keeping the
   exported function signatures identical. No page or component needs to
   change.

## Project structure

```
src/
  components/    Reusable UI: StatusBadge, LocationCard, MetricCard,
                 FloorButton, UnitTypeRow, ChecklistItem, PhotoSection,
                 TimelineItem, PunchListCard, MobileBottomNav, PageHeader,
                 RoleSwitcher
  layouts/       AppLayout (bottom nav shell)
  pages/         One file per screen (15 required screens + a few small
                 supporting screens: Notes, Update Status, More)
  services/      Data access layer (mock now, Supabase later)
  hooks/         Small reusable hooks
  types/         Single source of truth for the domain model
  data/          Mock data generation
  lib/           supabaseClient.ts
  context/       AuthContext (mock auth + role switch), DataContext
                 (selected project/floor/unit-type navigation state)
  routes/        ProtectedRoute (auth + role gating)
```

## Workflow implemented

Splash → Login → Project Selection → Project Dashboard → Select Floor →
Select Unit Type → Location Cards (search/filter/sort) → Work Card →
Installation Checklist / Photos / QC Inspection / Punch List / Notes &
Comments / Timeline / Update Status → Owner Dashboard → Kanban Production
Board (optional view, management roles only).

Bottom navigation: Home · Floors · Tasks · Dashboard · More. Owner
Dashboard and the Kanban board are gated to Project Manager / Owner (Kanban
also allows Foreman) and are hidden from Installer accounts via
`ProtectedRoute`.

## Design

Clean XA DOS navy-and-white palette (`#0B3D66` navy, `#1D6FE0` action blue,
`#EAF2FE` tint) with Fieldwire-style task cards: large touch targets, bold
status-colored badges (one distinct color per one of the six locked
statuses), bottom tab bar, minimal typing anywhere in the field flow.
