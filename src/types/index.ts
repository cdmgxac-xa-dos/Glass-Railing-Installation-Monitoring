// ---------------------------------------------------------------------------
// XA DOS — Glass Railing Installation Monitoring
// Shared domain types. This is the single source of truth for the data
// model. Services return these shapes whether the data comes from mock
// arrays (now) or Supabase (later) — pages never need to know the difference.
// ---------------------------------------------------------------------------

export type UnitType =
  | 'Studio'
  | '1BR'
  | '2BR'
  | 'Front End Unit'
  | 'Rear End Unit'
  | 'Balcony Partition'

export const UNIT_TYPES: UnitType[] = [
  'Studio',
  '1BR',
  '2BR',
  'Front End Unit',
  'Rear End Unit',
  'Balcony Partition',
]

export type LocationStatus =
  | 'Not Started'
  | 'In Progress'
  | 'QC Inspection'
  | 'Punch List'
  | 'On Hold'
  | 'Completed'

export const LOCATION_STATUSES: LocationStatus[] = [
  'Not Started',
  'In Progress',
  'QC Inspection',
  'Punch List',
  'On Hold',
  'Completed',
]

export type Priority = 'High' | 'Medium' | 'Low'

export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']

export type BracketSystem =
  | 'Bracket System A'
  | 'Bracket System B'
  | 'Bracket System C'

export const BRACKET_SYSTEMS: BracketSystem[] = [
  'Bracket System A',
  'Bracket System B',
  'Bracket System C',
]

export type AssignedTeam = 'Team A' | 'Team B' | 'Team C' | 'Team D'

export const ASSIGNED_TEAMS: AssignedTeam[] = ['Team A', 'Team B', 'Team C', 'Team D']

export type UserRole = 'Installer' | 'Foreman' | 'QC Inspector' | 'Project Manager' | 'Owner'

export const USER_ROLES: UserRole[] = [
  'Installer',
  'Foreman',
  'QC Inspector',
  'Project Manager',
  'Owner',
]

export interface AppUser {
  id: string
  name: string
  role: UserRole
  email: string
}

export interface Project {
  id: string
  code: string
  name: string
  location: string
  totalLocations: number
}

// One monitoring record = one complete glass railing location / run.
export interface RailingLocation {
  id: string // e.g. GR-021
  projectCode: string // e.g. PR-001
  projectName: string
  floorLevel: string // e.g. "12F", "GF", "Roof Deck"
  unitNo: string // e.g. "Unit 1201"
  unitType: UnitType
  totalLinearMeters: number
  totalGlassPanels: number
  bracketSystem: BracketSystem
  priority: Priority
  assignedTeam: AssignedTeam
  status: LocationStatus
  remarks: string
  updatedAt: string // ISO datetime
}

// ---- Installation checklist -----------------------------------------------

export type ChecklistStageKey =
  | 'areaReleased'
  | 'bracketInstalled'
  | 'glassDelivered'
  | 'glassInstalled'
  | 'alignmentChecked'
  | 'handrailInstalled'
  | 'accessoriesCompleted'
  | 'sealantCompleted'
  | 'finalInspection'
  | 'completed'

export interface ChecklistStageDef {
  key: ChecklistStageKey
  label: string
}

export const CHECKLIST_STAGES: ChecklistStageDef[] = [
  { key: 'areaReleased', label: 'Area Released' },
  { key: 'bracketInstalled', label: 'Bracket Installed' },
  { key: 'glassDelivered', label: 'Glass Delivered to Location' },
  { key: 'glassInstalled', label: 'Glass Installed' },
  { key: 'alignmentChecked', label: 'Alignment Checked' },
  { key: 'handrailInstalled', label: 'Handrail or Top Cap Installed' },
  { key: 'accessoriesCompleted', label: 'Accessories Completed' },
  { key: 'sealantCompleted', label: 'Sealant or Grouting Completed' },
  { key: 'finalInspection', label: 'Final Inspection' },
  { key: 'completed', label: 'Completed' },
]

export interface ChecklistEntry {
  stage: ChecklistStageKey
  isCompleted: boolean
  updatedAt: string | null
  updatedBy: string | null
  remark: string
}

export type ChecklistState = Record<ChecklistStageKey, ChecklistEntry>

// ---- Photos -----------------------------------------------------------------

export type PhotoCategory = 'Before' | 'During' | 'After' | 'Punch List'

export const PHOTO_CATEGORIES: PhotoCategory[] = ['Before', 'During', 'After', 'Punch List']

export interface LocationPhoto {
  id: string
  locationId: string
  category: PhotoCategory
  previewUrl: string
  fileName: string
  uploadedBy: string
  uploadedAt: string
}

// ---- QC Inspection ------------------------------------------------------

export type QCResult = 'Passed' | 'Failed'

export interface QCChecklistItemDef {
  key: string
  label: string
}

export const QC_CHECKLIST_ITEMS: QCChecklistItemDef[] = [
  { key: 'panelCondition', label: 'Glass panel condition' },
  { key: 'gapConsistency', label: 'Panel gap consistency' },
  { key: 'verticalAlignment', label: 'Vertical alignment' },
  { key: 'topAlignment', label: 'Top alignment' },
  { key: 'bracketSpacing', label: 'Bracket spacing' },
  { key: 'anchorCompletion', label: 'Anchor completion' },
  { key: 'handrailJoint', label: 'Handrail joint condition' },
  { key: 'sealantQuality', label: 'Sealant quality' },
  { key: 'scratchesChips', label: 'Glass scratches or chips' },
  { key: 'stabilityMovement', label: 'Stability or movement' },
  { key: 'missingAccessories', label: 'Missing accessories' },
]

export interface QCInspectionRecord {
  id: string
  locationId: string
  result: QCResult | null
  itemResults: Record<string, boolean>
  issueDescription?: string
  priority?: Priority
  photoAttached?: boolean
  inspectedBy: string
  inspectedAt: string
}

// ---- Punch list -----------------------------------------------------------

export type PunchListStatus = 'Open' | 'Assigned' | 'In Rectification' | 'For Verification' | 'Closed'

export const PUNCH_LIST_STATUSES: PunchListStatus[] = [
  'Open',
  'Assigned',
  'In Rectification',
  'For Verification',
  'Closed',
]

export interface PunchListItem {
  id: string
  locationId: string
  issueDescription: string
  category: string
  priority: Priority
  assignedTeam: AssignedTeam
  status: PunchListStatus
  dateFound: string
  targetCompletionDate: string
  rectificationNotes: string
  qcVerification: string
}

// ---- Notes / comments (maps to the `gr_comments` table) --------------------

export interface LocationComment {
  id: string
  locationId: string
  author: string
  text: string
  createdAt: string
}

// ---- Timeline ---------------------------------------------------------------

export interface TimelineEvent {
  id: string
  locationId: string
  date: string
  time: string
  user: string
  action: string
  remarks: string
}

// ---- Dashboard aggregate shapes -------------------------------------------

export interface StatusCounts {
  'Not Started': number
  'In Progress': number
  'QC Inspection': number
  'Punch List': number
  'On Hold': number
  Completed: number
}

export interface FloorStatusBreakdown {
  floorLevel: string
  statusCounts: StatusCounts
  locationCount: number
}

export interface ProjectDashboardSummary {
  projectName: string
  overallProgressPct: number
  statusCounts: StatusCounts
  locationsWorkedToday: number
  linearMetersInstalledToday: number
  panelsInstalledToday: number
  qcPending: number
  byFloorStatus: FloorStatusBreakdown[]
}

export interface OwnerDashboardSummary {
  totalLocations: number
  statusCounts: StatusCounts
  overallCompletionPct: number
  totalLinearMeters: number
  installedLinearMeters: number
  totalGlassPanels: number
  installedGlassPanels: number
  byFloor: { label: string; count: number }[]
  byUnitType: { label: string; count: number }[]
  byTeam: { label: string; count: number }[]
  byBracketSystem: { label: string; count: number }[]
  byStatus: { label: string; count: number }[]
}

export interface FloorSummary {
  floorLevel: string
  locationCount: number
}

export interface UnitTypeSummary {
  unitType: UnitType
  locationCount: number
}
