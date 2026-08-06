import type {
  AssignedTeam,
  BracketSystem,
  ChecklistState,
  LocationComment,
  LocationPhoto,
  LocationStatus,
  Priority,
  Project,
  PunchListItem,
  QCInspectionRecord,
  RailingLocation,
  TimelineEvent,
  UnitType,
} from '../types'
import { CHECKLIST_STAGES } from '../types'

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'PR-001',
    code: 'PR-001',
    name: 'The Spinnaker @ Club Laiya',
    location: 'Club Laiya, San Juan, Batangas',
    totalLocations: 30,
  },
  {
    id: 'PR-002',
    code: 'PR-002',
    name: 'Nasugbu Project',
    location: 'Nasugbu, Batangas',
    totalLocations: 0,
  },
  {
    id: 'PR-003',
    code: 'PR-003',
    name: 'Future Project',
    location: 'TBD',
    totalLocations: 0,
  },
]

export const FLOOR_ORDER: string[] = [
  'GF',
  ...Array.from({ length: 22 }, (_, i) => `${i + 2}F`), // 2F .. 23F
  'Roof Deck',
]

// ---------------------------------------------------------------------------
// Deterministic-ish sample generation for PR-001
// ---------------------------------------------------------------------------

const UNIT_TYPE_CYCLE: UnitType[] = [
  'Studio',
  '1BR',
  '2BR',
  'Front End Unit',
  'Rear End Unit',
  'Balcony Partition',
]
const BRACKET_CYCLE: BracketSystem[] = ['Bracket System A', 'Bracket System B', 'Bracket System C']
const TEAM_CYCLE: AssignedTeam[] = ['Team A', 'Team B', 'Team C', 'Team D']
const PRIORITY_CYCLE: Priority[] = ['High', 'Medium', 'Low']
const STATUS_CYCLE: LocationStatus[] = [
  'Not Started',
  'In Progress',
  'QC Inspection',
  'Punch List',
  'On Hold',
  'Completed',
  'In Progress',
  'Completed',
]

// Floors used for sample data — a realistic spread, not every floor.
const SAMPLE_FLOORS = ['GF', '2F', '3F', '4F', '5F', '8F', '9F', '12F', '15F', '18F', '20F', 'Roof Deck']

function pad3(n: number): string {
  return n.toString().padStart(3, '0')
}

function buildLocation(index: number): RailingLocation {
  const n = index + 1
  const floor = SAMPLE_FLOORS[index % SAMPLE_FLOORS.length]
  const unitType = UNIT_TYPE_CYCLE[index % UNIT_TYPE_CYCLE.length]
  const bracket = BRACKET_CYCLE[index % BRACKET_CYCLE.length]
  const team = TEAM_CYCLE[index % TEAM_CYCLE.length]
  const priority = PRIORITY_CYCLE[index % PRIORITY_CYCLE.length]
  const status = STATUS_CYCLE[index % STATUS_CYCLE.length]

  const unitNumberBase = floor === 'GF' ? 100 : floor === 'Roof Deck' ? 2300 : parseInt(floor) * 100
  const unitNo =
    floor === 'GF'
      ? `Lobby Bay ${n}`
      : floor === 'Roof Deck'
        ? `Roof Deck Bay ${n}`
        : `Unit ${unitNumberBase + (n % 6) + 1}`

  const linearMeters = Math.round((6 + ((index * 7) % 14) + ((index % 3) * 0.4)) * 10) / 10
  const panels = Math.max(3, Math.round(linearMeters / 0.9))

  const remarksPool = [
    '',
    '',
    '',
    'Awaiting glass delivery confirmation.',
    'Minor scratch noted, monitoring.',
    'Client walkthrough scheduled.',
    'Access restricted on weekends.',
  ]

  return {
    id: `GR-${pad3(n)}`,
    projectCode: 'PR-001',
    projectName: 'The Spinnaker @ Club Laiya',
    floorLevel: floor,
    unitNo,
    unitType,
    totalLinearMeters: linearMeters,
    totalGlassPanels: panels,
    bracketSystem: bracket,
    priority,
    assignedTeam: team,
    status,
    remarks: remarksPool[index % remarksPool.length],
    updatedAt: new Date(Date.now() - index * 3 * 60 * 60 * 1000).toISOString(),
  }
}

export const MOCK_LOCATIONS: RailingLocation[] = Array.from({ length: 30 }, (_, i) => buildLocation(i))

// Keep the one fully-worked example from the spec as GR-021 exactly as given.
const specExampleIndex = MOCK_LOCATIONS.findIndex((l) => l.id === 'GR-021')
if (specExampleIndex >= 0) {
  MOCK_LOCATIONS[specExampleIndex] = {
    id: 'GR-021',
    projectCode: 'PR-001',
    projectName: 'The Spinnaker @ Club Laiya',
    floorLevel: '12F',
    unitNo: 'Unit 1201',
    unitType: 'Studio',
    totalLinearMeters: 12.6,
    totalGlassPanels: 14,
    bracketSystem: 'Bracket System A',
    priority: 'High',
    assignedTeam: 'Team A',
    status: 'In Progress',
    remarks: 'None',
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Checklist mock state (per location, generated on demand — see service)
// ---------------------------------------------------------------------------

export function buildInitialChecklist(location: RailingLocation): ChecklistState {
  // For non-"Not Started" locations, mark a realistic number of early
  // stages complete so the mock feels alive.
  const progressIndex: Record<LocationStatus, number> = {
    'Not Started': 0,
    'In Progress': 5,
    'QC Inspection': 8,
    'Punch List': 8,
    'On Hold': 3,
    Completed: 10,
  }
  const completedCount = progressIndex[location.status]

  const state = {} as ChecklistState
  CHECKLIST_STAGES.forEach((stage, i) => {
    const isCompleted = i < completedCount
    state[stage.key] = {
      stage: stage.key,
      isCompleted,
      updatedAt: isCompleted
        ? new Date(Date.now() - (completedCount - i) * 6 * 60 * 60 * 1000).toISOString()
        : null,
      updatedBy: isCompleted ? location.assignedTeam + ' Lead' : null,
      remark: '',
    }
  })
  return state
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export const MOCK_PHOTOS: LocationPhoto[] = []

// ---------------------------------------------------------------------------
// Notes / comments
// ---------------------------------------------------------------------------

export const MOCK_COMMENTS: LocationComment[] = []

// ---------------------------------------------------------------------------
// QC inspections
// ---------------------------------------------------------------------------

export const MOCK_QC_RECORDS: QCInspectionRecord[] = MOCK_LOCATIONS.filter(
  (l) => l.status === 'QC Inspection' || l.status === 'Punch List' || l.status === 'Completed',
).map((l, i) => ({
  id: `QC-${pad3(i + 1)}`,
  locationId: l.id,
  result: l.status === 'Punch List' ? 'Failed' : l.status === 'Completed' ? 'Passed' : null,
  itemResults: {},
  inspectedBy: 'QC Inspector — J. Ramos',
  inspectedAt: new Date(Date.now() - i * 8 * 60 * 60 * 1000).toISOString(),
}))

// ---------------------------------------------------------------------------
// Punch list
// ---------------------------------------------------------------------------

const PUNCH_CATEGORIES = ['Glass Defect', 'Alignment', 'Sealant', 'Hardware', 'Cleanliness']

export const MOCK_PUNCH_LIST: PunchListItem[] = MOCK_LOCATIONS.filter((l) => l.status === 'Punch List').map(
  (l, i) => ({
    id: `PL-${pad3(i + 1)}`,
    locationId: l.id,
    issueDescription:
      i % 2 === 0
        ? 'Vertical gap inconsistent between panels 3 and 4.'
        : 'Sealant bead uneven along base track.',
    category: PUNCH_CATEGORIES[i % PUNCH_CATEGORIES.length],
    priority: l.priority,
    assignedTeam: l.assignedTeam,
    status: i % 3 === 0 ? 'In Rectification' : i % 3 === 1 ? 'Assigned' : 'Open',
    dateFound: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    targetCompletionDate: new Date(Date.now() + (3 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    rectificationNotes: '',
    qcVerification: '',
  }),
)

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function timelineForLocation(location: RailingLocation): TimelineEvent[] {
  const base = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  const steps: { action: string; remarks: string }[] = [
    { action: 'Area Released', remarks: 'Site cleared and ready for bracket works.' },
    { action: 'Bracket Installed', remarks: `Installed by ${location.assignedTeam}.` },
  ]
  if (['In Progress', 'QC Inspection', 'Punch List', 'Completed'].includes(location.status)) {
    steps.push({ action: 'Glass Installed', remarks: `${location.totalGlassPanels} panels set.` })
  }
  if (['QC Inspection', 'Punch List', 'Completed'].includes(location.status)) {
    steps.push({ action: 'QC Inspection Requested', remarks: 'Submitted for inspection.' })
  }
  if (location.status === 'Punch List') {
    steps.push({ action: 'QC Failed', remarks: 'Punch list item raised — see Punch List tab.' })
    steps.push({ action: 'Punch List Created', remarks: 'Assigned for rectification.' })
  }
  if (location.status === 'Completed') {
    steps.push({ action: 'QC Passed', remarks: 'All checklist items verified.' })
    steps.push({ action: 'Completed', remarks: 'Location signed off.' })
  }

  return steps.map((s, i) => {
    const d = new Date(base.getTime() + i * 20 * 60 * 60 * 1000)
    return {
      id: `${location.id}-EVT-${i + 1}`,
      locationId: location.id,
      date: d.toISOString().slice(0, 10),
      time: d.toTimeString().slice(0, 5),
      user: location.assignedTeam + ' Lead',
      action: s.action,
      remarks: s.remarks,
    }
  })
}

export const MOCK_TIMELINE: TimelineEvent[] = MOCK_LOCATIONS.flatMap(timelineForLocation)
