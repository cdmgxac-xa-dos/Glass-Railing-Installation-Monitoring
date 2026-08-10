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
  | 'Studio Unit'
  | '1 BR'
  | '2 BR'
  | 'Beachfront'

export const UNIT_TYPES: UnitType[] = [
  'Studio',
  '1BR',
  '2BR',
  'Front End Unit',
  'Rear End Unit',
  'Balcony Partition',
  'Studio Unit',
  '1 BR',
  '2 BR',
  'Beachfront',
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

// Known values, used to seed dropdowns/filters — not an exhaustive type.
// The database has no constraint on this column (matches UnitType below):
// real registers keep introducing new material specs (e.g. 'U-Channel'),
// and RailingLocation.bracketSystem below is typed as plain `string` so a
// value this list doesn't yet know about still loads and displays fine.
export type BracketSystem =
  | 'Bracket System A'
  | 'Bracket System B'
  | 'Bracket System C'
  | 'CKB-4735'
  | 'U-Channel'

export const BRACKET_SYSTEMS: BracketSystem[] = [
  'Bracket System A',
  'Bracket System B',
  'Bracket System C',
  'CKB-4735',
  'U-Channel',
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
  // Real-mode only: the underlying DB role_code (e.g. 'field_pic',
  // 'qc_officer', 'safety_officer') before collapsing into the 5-value
  // UserRole above. Several distinct role_codes map to the same UserRole
  // (e.g. 'QC Inspector' covers qc_officer/field_pic/safety_officer), so
  // features that need to distinguish between them — like floor-plan pin
  // management — read this instead of `role`. Undefined in mock mode.
  roleCode?: string
  // Real-mode only: true for a newly created account whose password was
  // set by an admin rather than chosen by the person themselves. While
  // true, ProtectedRoute forces every route to /change-password until
  // they set their own. Undefined/false in mock mode.
  mustChangePassword?: boolean
}

export interface Project {
  id: string
  code: string
  name: string
  location: string
  totalLocations: number
}

// One monitoring record = one installation location/run, for any scope
// (Railings, Doors & Windows, ...) — despite the name, not Railing-only.
export interface RailingLocation {
  // Database primary key. Globally unique across every project, so for
  // scopes whose own register numbers locations per-project (e.g. Doors &
  // Windows registers that each restart at 'AGD-001') this is prefixed by
  // project (e.g. 'SPN-AGD-001') to stay unique — the original register
  // label lives in `reference` below for display. Railing locations don't
  // need a prefix (their own IDs, e.g. 'GR-021', are already globally
  // unique), so `id` and `reference` are the same value there.
  id: string // e.g. GR-021, SPN-AGD-001
  // The human-facing label from the source register (e.g. 'GR-021',
  // 'AGD-001') — what's printed on physical location tags on site and
  // what field crews should see on screen. Optional only because mock
  // data predates this field; falls back to `id` wherever displayed.
  reference?: string
  projectCode: string // e.g. PR-001
  projectName: string
  floorLevel: string // e.g. "12F", "GF", "Roof Deck"
  // Optional: real registers can leave this blank (a majority of the
  // Spinnaker Windows register does, across nearly every floor and unit
  // type) — display should fall back to `windowTag` or similar rather
  // than assume this is always present.
  unitNo?: string // e.g. "Unit 1201"
  unitType: UnitType
  // Railing-specific measurements. Optional because Doors & Windows
  // locations don't have them — a window has no "linear meters of
  // railing" or "glass panel count" in this sense.
  totalLinearMeters?: number
  totalGlassPanels?: number
  // Free text (see BracketSystem note above) — Railing-specific; absent
  // for Doors & Windows locations.
  bracketSystem?: string
  // Doors & Windows-specific fields — absent for Railing locations.
  windowTag?: string
  windowSystem?: string
  towerBuilding?: string
  // Optional because real registers are frequently imported before crews
  // are assigned — a location can genuinely have no priority/team yet.
  // UI should show "Unassigned" rather than treat this as missing data.
  priority?: Priority
  assignedTeam?: AssignedTeam
  status: LocationStatus
  remarks: string
  updatedAt: string // ISO datetime
  // Installation scope ('RAILING', 'DOORS_WINDOWS', ...) — optional because
  // mock-mode location objects predate the scope column and are always
  // Railing; real-mode rows always have it (see gr_locations.scope).
  // Anything reading this should fall back to 'RAILING' when absent.
  scope?: string
}

// ---- Floor plan pins --------------------------------------------------------

export interface FloorPlan {
  id: string
  projectCode: string
  floorLevel: string
  imageUrl: string
  imageWidth?: number
  imageHeight?: number
  uploadedBy?: string
  createdAt: string
  updatedAt: string
}

export interface LocationPin {
  id: string
  floorPlanId: string
  locationId: string
  xPct: number // 0-1, relative to image width
  yPct: number // 0-1, relative to image height
  createdBy?: string
  createdAt: string
  updatedAt: string
}

// ---- Installation checklist -----------------------------------------------

// A plain string, not a closed union: which keys are valid depends on the
// location's installation scope (see checklist_templates /
// supabase/05_scope_foundation.sql, 06_doors_windows_templates.sql).
// CHECKLIST_STAGES below is the Railing scope's own list, and remains the
// literal source of truth for that scope's stage keys/order/labels — it
// mirrors checklist_templates' 'RAILING' row exactly, kept here as the
// fallback used in mock/offline mode. DOORS_WINDOWS_CHECKLIST_STAGES is the
// same idea for that scope.
export type ChecklistStageKey = string

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

// Doors & Windows scope's checklist (owner's expansion plan, Section 13).
// One shared 12-step flow for both door and window items rather than
// separate door/window variants — the plan's item-specific extra
// checkpoints (water test, operation test, lock/handle test) are folded
// into "Testing Completed" rather than branched into their own templates.
export const DOORS_WINDOWS_CHECKLIST_STAGES: ChecklistStageDef[] = [
  { key: 'openingReleased', label: 'Opening Released' },
  { key: 'openingDimensionChecked', label: 'Opening Dimension Checked' },
  { key: 'frameDelivered', label: 'Frame Delivered' },
  { key: 'frameInstalled', label: 'Frame Installed' },
  { key: 'frameAlignmentChecked', label: 'Frame Alignment Checked' },
  { key: 'glassInstalled', label: 'Glass Installed' },
  { key: 'hardwareInstalled', label: 'Hardware Installed' },
  { key: 'adjustmentCompleted', label: 'Adjustment Completed' },
  { key: 'sealantCompleted', label: 'Sealant Completed' },
  { key: 'testingCompleted', label: 'Testing Completed' },
  { key: 'qcInspectionPassed', label: 'QC Inspection Passed' },
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
  previewUrl: string // full ~400-600KB main image — used for detail views/report PDFs
  thumbnailUrl: string // ~50KB thumbnail — used for grid/list display
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

// Doors & Windows scope's QC checklist — one shared list for both door and
// window items, covering the same ground as the Railing list (condition,
// alignment, fastening, sealant) plus door/window-specific checks the plan
// calls out (operation smoothness, lock/handle function, water test).
export const DOORS_WINDOWS_QC_ITEMS: QCChecklistItemDef[] = [
  { key: 'openingDimensionAccuracy', label: 'Opening dimension accuracy' },
  { key: 'frameCondition', label: 'Frame condition (no dents or scratches)' },
  { key: 'frameAlignment', label: 'Frame alignment (level and plumb)' },
  { key: 'frameAnchoring', label: 'Frame anchoring and fastening' },
  { key: 'glassCondition', label: 'Glass panel condition' },
  { key: 'hardwareInstallation', label: 'Hardware installation' },
  { key: 'operationSmoothness', label: 'Operation smoothness' },
  { key: 'lockHandleFunction', label: 'Lock and handle function' },
  { key: 'sealantQuality', label: 'Sealant and weatherproofing quality' },
  { key: 'waterTightness', label: 'Water test result' },
  { key: 'gapClearance', label: 'Gap and clearance consistency' },
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

// ---- Recent activity --------------------------------------------------------

// There is no dedicated events/activity-log table. Activity is derived at
// query time from the updated_at / created_at / inspected_at / uploaded_at
// columns already present on the gr_* tables (see activityService.ts), so
// this type is a normalised view over several different row shapes rather
// than a mapping of one table.
export type ActivityType =
  | 'status_change'
  | 'qc_inspection'
  | 'punch_list'
  | 'photo_upload'
  | 'pin_placed'
  | 'floor_plan_uploaded'

export interface ActivityEntry {
  id: string // `${sourceTable}-${sourceId}-${timestamp}` — unique feed key
  type: ActivityType
  description: string // human-readable, e.g. 'Status changed to Punch List'
  locationTagId?: string // e.g. 'GR-021' — absent for project-level events
  locationUnitNo?: string // e.g. '601'
  timestamp: string // ISO datetime
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

// Progress rolled up per installation scope (Railings, Doors & Windows,
// ...) — see the Field Installation Monitoring expansion plan, Section 14.
// Every project today has locations in exactly one scope, so this always
// resolves to a single-entry array; pages only render a "by scope" section
// once there's more than one entry to actually compare.
export interface ScopeProgress {
  scope: string
  scopeName: string
  totalLocations: number
  completedLocations: number
  progressPct: number
}

export interface FloorScopeBreakdown {
  floorLevel: string
  scope: string
  scopeName: string
  locationCount: number
  progressPct: number
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
  byScope: ScopeProgress[]
  byFloorScope: FloorScopeBreakdown[]
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
  byScope: ScopeProgress[]
}

export interface ReportConfig {
  includeGeneralSummary: boolean
  includeByFloor: boolean
  includeByStatus: boolean
  includeByUnitType: boolean
  includeByBracketSystem: boolean
  includeByTeam: boolean
  includeByPunchList: boolean
  includeFloorPlans: boolean
  includeFullDetail: boolean
  includeFullDetailPhotos: boolean
  includeFullDetailQcPunchHistory: boolean
}

export interface ReportHistoryEntry {
  id: string
  projectCode: string
  reportTitle: string
  config: ReportConfig
  storagePath: string
  generatedBy: string
  generatedAt: string
  isAutomatic: boolean
}

export interface FloorSummary {
  floorLevel: string
  locationCount: number
}

export interface UnitTypeSummary {
  unitType: UnitType
  locationCount: number
}
