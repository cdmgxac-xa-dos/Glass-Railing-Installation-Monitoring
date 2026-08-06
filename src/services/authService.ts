import type { AppUser, UserRole } from '../types'

// Mock authentication. Real version would call supabase.auth.signInWithPassword.
const MOCK_USERS: Record<UserRole, AppUser> = {
  Installer: { id: 'u-installer', name: 'Mark Dizon', role: 'Installer', email: 'mark.dizon@xados.local' },
  Foreman: { id: 'u-foreman', name: 'Ronnie Cruz', role: 'Foreman', email: 'ronnie.cruz@xados.local' },
  'QC Inspector': { id: 'u-qc', name: 'Joy Ramos', role: 'QC Inspector', email: 'joy.ramos@xados.local' },
  'Project Manager': { id: 'u-pm', name: 'Elaine Torres', role: 'Project Manager', email: 'elaine.torres@xados.local' },
  Owner: { id: 'u-owner', name: 'Antonio Xavier', role: 'Owner', email: 'antonio.xavier@xados.local' },
}

export async function mockLogin(email: string, _password: string): Promise<AppUser> {
  // For the mock build, any email/password combination logs in as Project
  // Manager unless the email hints at another role.
  await new Promise((r) => setTimeout(r, 400))
  const lower = email.toLowerCase()
  if (lower.includes('install')) return MOCK_USERS.Installer
  if (lower.includes('foreman')) return MOCK_USERS.Foreman
  if (lower.includes('qc')) return MOCK_USERS['QC Inspector']
  if (lower.includes('owner')) return MOCK_USERS.Owner
  return MOCK_USERS['Project Manager']
}

export function getUserForRole(role: UserRole): AppUser {
  return MOCK_USERS[role]
}
