import type { LocationStatus } from '../types'

// XA Design Studio approved brand tokens (DR-0003, tokens.json v0.2.0) —
// functional.neutral/warning/danger/success plus the approved data-viz
// purple for "On Hold" (there's no dedicated functional color for it).
export const STATUS_COLORS: Record<LocationStatus, string> = {
  'Not Started': '#5A6672',
  'In Progress': '#0A5C8A',
  'QC Inspection': '#B87514',
  'Punch List': '#C0392F',
  'On Hold': '#7A5EA8',
  Completed: '#1E7F5C',
}

export const STATUS_ORDER: LocationStatus[] = [
  'Not Started',
  'In Progress',
  'QC Inspection',
  'Punch List',
  'On Hold',
  'Completed',
]
