# Client Shop Drawing Transparency Tracker

A standalone web app that turns the client's Excel shop-drawing/BOM tracking
sheet into a live dashboard: XA manages the workflow, draftsmen update
assigned tasks, DAAA and GPI review and approve, and the client watches
progress in real time. **This is not part of XA DOS** — separate app,
separate Supabase project, lives in this repo only as a sibling folder.

Built against `Client_Shop_Drawing_Transparency_Tracker_MD_File_v1.1` with
Supabase (Postgres + Auth + Storage) in place of the spec's suggested
Google Sheets/Drive backend, per request.

## Tech stack

React 18 + Vite + TypeScript + Tailwind CSS + React Router + Supabase JS
v2 + one Supabase Edge Function (passwordless sign-in) + `xlsx` for
re-importing the register from Excel.

## Roles & permissions

Implements the spec's permission matrix exactly (see `supabase/02_functions.sql`
— every mutation is a `SECURITY DEFINER` RPC that checks the caller's role
and the drawing's current status before doing anything; direct table writes
are locked down to XA via RLS):

| Action | XA | Draftsman | DAAA | GPI |
|---|---|---|---|---|
| View drawings / PDFs / audit history | ✅ | ✅ (own) | ✅ | ✅ |
| Import Excel / create / edit / delete item | ✅ | – | – | – |
| Assign draftsman, set target date | ✅ | – | – | – |
| Upload / replace PDF | ✅ | ✅ (own, while drafting) | – | – |
| Submit to DAAA | ✅ | – | – | – |
| Approve / request revision (with comments) | – | – | ✅ | ✅ |
| Reject | – | – | – | ✅ |

Status workflow (all 10 spec statuses): Not Started → Assigned → Drafting →
Internal Review → Submitted to DAAA → DAAA Review → GPI Review → Approved →
Completed, with Revision Required looping back to a reassigned Draftsman
(the drawing's `revision_number` increments each time).

## Login

- **XA Admin / Site Engineer** — password-protected. The very first one is
  created from the login screen itself (shows "Set up the first Admin
  account" until one exists) with password **`0000`**, and the app forces
  a password change immediately after that first sign-in. Any additional
  XA Admin accounts XA creates from **Users** also start at `0000` with a
  forced change.
- **Draftsman / DAAA / GPI** — no password. The login screen lists
  accounts by role; picking a name signs you in directly. Under the hood
  this still produces a real, RLS-respecting Supabase session — see
  "Passwordless sign-in" below.
- **Client Transparency Dashboard** (`/client`) — fully public, no login,
  read-only. Shows progress, status, dates, approved PDFs and a workflow
  timeline; never shows drawings that aren't yet Approved/Completed, and
  never shows internal remarks (only formal submission/review events).

### Passwordless sign-in, and why it needs an Edge Function

Supabase Auth sessions can only be minted by the Auth server — there's no
way for a plain SQL function to hand back a valid session. So "no password"
for Draftsman/DAAA/GPI is implemented as: the login screen calls the
`passwordless-login` Edge Function with the chosen account's id; the
function (using the service-role key, server-side only) generates a
magic-link OTP for that account's email and immediately redeems it, then
returns the resulting access/refresh tokens to the browser, which installs
them with `supabase.auth.setSession()`. No password exists for these
accounts at all, and nothing is ever emailed or shown.

## Setup

1. **Create a Supabase project** (separate from any XA DOS project).
2. **Auth settings** — under Authentication → Providers → Email, turn
   **off** "Confirm email". Account creation in this app signs a brand-new
   user up and immediately writes their `profiles` row in the same request;
   if email confirmation is required, that user has no session yet and the
   profile insert will fail RLS. (Standard setting for internal/staff
   tools — nobody outside your org can reach the sign-up flow, since it's
   only ever called from the "Add account" screen.)
3. **Run the SQL**, in order, in the Supabase SQL Editor:
   - `supabase/01_schema.sql` — tables, enums, RLS, storage bucket + policies, public views
   - `supabase/02_functions.sql` — all workflow RPCs
   - `supabase/03_seed_register.sql` — preloads the 124 register items (see below)
4. **Deploy the Edge Function**:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy passwordless-login
   ```
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are
   injected automatically — no secrets to set by hand.
5. **Configure the app**:
   ```bash
   cp .env.example .env.local   # fill in your project URL + anon key
   npm install
   npm run dev
   ```
6. Open the app, create the first XA Admin account, sign in with `0000`,
   set a real password, then use **Users** to add draftsmen/DAAA/GPI
   accounts (they need a real email address each — that's what the
   magic-link OTP under the passwordless flow authenticates against, even
   though nobody ever sees or types it).

## The preloaded register

`supabase/03_seed_register.sql` preloads **124 items** from the client's
Excel file (`ORIG` sheet — "BILL OF MATERIALS", Project: *The Spinnaker at
Club Laiya*, CP19 — Supply and Delivery of Panel Boards and Breakers, Meter
Center, kWh Meter & Switch Gear), sorted by item number, each with its
category carried along (shown under the description in the Register and
Client Dashboard — e.g. item `6.5` "PPSA (STUDIO UNIT)" under **Residential
Panelboards & Circuit Breakers**).

Two judgment calls made while parsing the sheet, in case anyone reconciles
against the original file:
- Items **1.0–4.0** (switchgear/MCBs) and **5.0** (kWh meters) sit above the
  sheet's first named category row, so they were grouped as "Main
  Switchgear & Feeder Breakers" and "Metering" respectively. Item 5.0's
  four amp-rating variants (100A/70A/60A/50A), which share one item number
  in the source with no sub-numbering, were split into `5.0`, `5.0-v2`,
  `5.0-v3`, `5.0-v4` so each keeps its own quantity.
- The source spreadsheet has three item numbers that Excel stored as
  numbers and silently truncated (`6.10`→`6.1`, `7.10`→`7.1`, `11.10`→`11.1`,
  each colliding with an already-used number). These were corrected back to
  `.10` based on sheet position so every item number is unique and sortable.

Once seeded, XA can re-import at any time from **Drawing Register → Import
Excel** (expects columns `item_no`, `description`, `category`, `sheet_no`,
`reference`, `unit`, `qty`) — it upserts by `item_no`.

## Project structure

```
src/
  components/   StatusBadge, DrawingListTable, PdfPanel, Timeline, StatCard
  context/      AuthContext
  layouts/      AppLayout (role-aware top nav)
  pages/        Login, ChangePassword, RoleHome (dashboard/queues per role),
                DrawingRegister, DrawingDetail, Users, ClientDashboard
  routes/       ProtectedRoute (auth + must-change-password + role gating)
  services/     authService, drawingService, pdfService, clientDashboardService
  types/        Domain model — mirrors the SQL schema exactly
supabase/
  01_schema.sql, 02_functions.sql, 03_seed_register.sql
  functions/passwordless-login/index.ts
```

## Note on this build

Written in a sandboxed environment with no live Supabase project to test
against — `npm install`, `tsc -b` and `vite build` all run clean here, but
please run the SQL + Edge Function deploy against a real project and open
an issue (or just tell me) if anything doesn't line up; I'll fix it
immediately.
