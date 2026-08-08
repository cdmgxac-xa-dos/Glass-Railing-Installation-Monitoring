import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { AppUser, UserRole } from '../types'

// ---------------------------------------------------------------------------
// Auth service — DUAL MODE, same pattern as every other service.
//
// Mock mode: unchanged from the original — any email/password combination
// logs in, role inferred from email substring.
//
// Real mode: calls supabase.auth.signInWithPassword() against real
// auth.users accounts (confirmed live: installer@, qc-01@, so-01@,
// pic-01@xaglass.com.ph, all with real last_sign_in_at history from the
// Project Monitoring module). After a successful sign-in, hydrates the
// app's AppUser shape via app_users -> employees (full_name) and
// app_users -> roles (role_code), then maps the real role_code onto the
// app's five-value UserRole via ROLE_CODE_MAP below.
//
// ROLE MAPPING — locked decision:
//   installer       -> 'Installer'
//   qc_officer      -> 'QC Inspector'
//   field_pic       -> 'QC Inspector'  (same tier, no dedicated UI role)
//   safety_officer  -> 'QC Inspector'  (same tier, no dedicated UI role)
//   projects        -> 'Project Manager'
//   owner           -> 'Owner'
// 'fieldops' and 'foreman' no longer exist as roles at all (removed from
// XA DOS's roles table this session — Project Manager was promoted to
// 'full' field_ops access to take over fieldops' former tier). No real
// role maps to 'Foreman' anymore; that UserRole value is kept in the type
// only for the mock role-switcher's local dev preview, never produced by
// real login.
//
// Any other real role_code (owner-adjacent admin roles, 'employee', etc.)
// that isn't in this map is NOT permitted to log into this app — real
// mode throws rather than guessing a fallback role, since silently
// defaulting someone into a role they don't have would be a real security
// mismatch against RLS, not just a display bug.
// ---------------------------------------------------------------------------

const ROLE_CODE_MAP: Record<string, UserRole> = {
  installer: 'Installer',
  qc_officer: 'QC Inspector',
  field_pic: 'QC Inspector',
  safety_officer: 'QC Inspector',
  warehouseman: 'Foreman', // new site-level role, no dedicated UI role yet — reuses the unused 'Foreman' bucket
  projects: 'Project Manager',
  owner: 'Owner',
}

// roleCode mirrors the real role_code each mock user would map from (see
// ROLE_CODE_MAP above) — needed so mock-mode UI testing of role_code-level
// checks (e.g. floor-plan pin management) behaves the same as real mode.
// 'Foreman' has no real role_code equivalent anymore (see note above), so
// it's left undefined — correctly excluded from any roleCode-based check.
const MOCK_USERS: Record<UserRole, AppUser> = {
  Installer: { id: 'u-installer', name: 'Mark Dizon', role: 'Installer', email: 'mark.dizon@xados.local', roleCode: 'installer' },
  Foreman: { id: 'u-foreman', name: 'Ronnie Cruz', role: 'Foreman', email: 'ronnie.cruz@xados.local' },
  'QC Inspector': { id: 'u-qc', name: 'Joy Ramos', role: 'QC Inspector', email: 'joy.ramos@xados.local', roleCode: 'qc_officer' },
  'Project Manager': { id: 'u-pm', name: 'Elaine Torres', role: 'Project Manager', email: 'elaine.torres@xados.local', roleCode: 'projects' },
  Owner: { id: 'u-owner', name: 'Antonio Xavier', role: 'Owner', email: 'antonio.xavier@xados.local', roleCode: 'owner' },
}

interface HydrationRow {
  id: string
  login_email: string
  must_change_password: boolean
  full_name: string | null
  role_code: string
}

async function hydrateAppUser(authUserId: string): Promise<AppUser> {
  const { data, error } = await supabase!
    .from('app_users')
    .select('id, login_email, must_change_password, role:roles(role_code), employee:employees(full_name)')
    .eq('id', authUserId)
    .single()

  if (error) throw error

  // Supabase's nested-select shape for a to-one FK join.
  const row = data as unknown as {
    id: string
    login_email: string
    must_change_password: boolean
    role: { role_code: string } | null
    employee: { full_name: string | null } | null
  }

  const roleCode = row.role?.role_code
  if (!roleCode) {
    throw new Error('This account has no assigned role and cannot use this app.')
  }

  const mappedRole = ROLE_CODE_MAP[roleCode]
  if (!mappedRole) {
    throw new Error(
      `This account's role ("${roleCode}") is not permitted to use the Glass Railing app.`,
    )
  }

  return {
    id: row.id,
    name: row.employee?.full_name ?? row.login_email,
    role: mappedRole,
    email: row.login_email,
    roleCode,
    mustChangePassword: row.must_change_password,
  }
}

export async function login(email: string, password: string): Promise<AppUser> {
  if (!isSupabaseConfigured) {
    await new Promise((r) => setTimeout(r, 400))
    const lower = email.toLowerCase()
    if (lower.includes('install')) return MOCK_USERS.Installer
    if (lower.includes('foreman')) return MOCK_USERS.Foreman
    if (lower.includes('qc')) return MOCK_USERS['QC Inspector']
    if (lower.includes('owner')) return MOCK_USERS.Owner
    return MOCK_USERS['Project Manager']
  }

  const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.user) throw new Error('Login succeeded but no user was returned.')

  return hydrateAppUser(data.user.id)
}

// Used by ChangePasswordPage — sets the account's real password (chosen by
// the person themselves, not the admin-set temporary one) and clears the
// must-change flag server-side via a narrow security-definer RPC that can
// only ever touch the calling user's own row (see
// xa_dos_migrations/21_new_field_crew_accounts.sql, mark_password_changed()).
export async function changePassword(newPassword: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword })
  if (updateError) throw updateError
  const { error: rpcError } = await supabase!.rpc('mark_password_changed')
  if (rpcError) throw rpcError
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase!.auth.signOut()
  if (error) throw error
}

// Restores the app's AppUser shape from an existing Supabase session, e.g.
// on page load/refresh. Returns null if there's no active session.
export async function getCurrentUser(): Promise<AppUser | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase!.auth.getSession()
  if (!data.session?.user) return null
  return hydrateAppUser(data.session.user.id)
}

// Mock-only role preview, used by the local dev role-switcher. Throws in
// real mode — switching the displayed role without switching the actual
// authenticated Supabase session would show a UI role that doesn't match
// real RLS permissions underneath, which is a dangerous mismatch, not a
// harmless preview.
export function getUserForRole(role: UserRole): AppUser {
  if (isSupabaseConfigured) {
    throw new Error('Role switching is only available in mock mode.')
  }
  return MOCK_USERS[role]
}
