import type { LocationStatus } from '../types'

export const STATUS_COLORS: Record<LocationStatus, string> = {
  'Not Started': '#8A99A8',
  'In Progress': '#1D6FE0',
  'QC Inspection': '#B8860B',
  'Punch List': '#D0453B',
  'On Hold': '#6B5B95',
  Completed: '#1E8E5A',
}

export const STATUS_ORDER: LocationStatus[] = [
  'Not Started',
  'In Progress',
  'QC Inspection',
  'Punch List',
  'On Hold',
  'Completed',
]
