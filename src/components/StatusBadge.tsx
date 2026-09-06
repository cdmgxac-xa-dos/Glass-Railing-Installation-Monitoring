import type { LocationStatus, PunchListStatus, Priority, QCResult } from '../types'

type BadgeValue = LocationStatus | PunchListStatus | Priority | QCResult

// XA Design Studio approved brand tokens (DR-0003, tokens.json v0.2.0) —
// same functional colors as STATUS_COLORS (constants/statusColors.ts) and
// the approved data-viz purple for "hold"/"needs re-check" states, applied
// here as a tinted-wash badge (10% bg, full-strength text/border) rather
// than the pins' solid fill.
const NEUTRAL = 'bg-[#5A6672]/10 text-[#5A6672] border-[#5A6672]/30'
const PRIMARY = 'bg-[#0A5C8A]/10 text-[#0A5C8A] border-[#0A5C8A]/30'
const WARNING = 'bg-[#B87514]/10 text-[#B87514] border-[#B87514]/30'
const DANGER = 'bg-[#C0392F]/10 text-[#C0392F] border-[#C0392F]/30'
const HOLD = 'bg-[#7A5EA8]/10 text-[#7A5EA8] border-[#7A5EA8]/30'
const SUCCESS = 'bg-[#1E7F5C]/10 text-[#1E7F5C] border-[#1E7F5C]/30'

const STATUS_STYLES: Record<string, string> = {
  'Not Started': NEUTRAL,
  'In Progress': PRIMARY,
  'QC Inspection': WARNING,
  'Punch List': DANGER,
  'On Hold': HOLD,
  Completed: SUCCESS,
  // Punch list statuses
  Open: DANGER,
  Assigned: WARNING,
  'In Rectification': PRIMARY,
  'For Verification': HOLD,
  Closed: SUCCESS,
  // Priority
  High: DANGER,
  Medium: WARNING,
  Low: NEUTRAL,
  // QC result
  Passed: SUCCESS,
  Failed: DANGER,
}

const NEUTRAL_DOT = 'bg-[#5A6672]'
const PRIMARY_DOT = 'bg-[#0A5C8A]'
const WARNING_DOT = 'bg-[#B87514]'
const DANGER_DOT = 'bg-[#C0392F]'
const HOLD_DOT = 'bg-[#7A5EA8]'
const SUCCESS_DOT = 'bg-[#1E7F5C]'

const DOT_STYLES: Record<string, string> = {
  'Not Started': NEUTRAL_DOT,
  'In Progress': PRIMARY_DOT,
  'QC Inspection': WARNING_DOT,
  'Punch List': DANGER_DOT,
  'On Hold': HOLD_DOT,
  Completed: SUCCESS_DOT,
  Open: DANGER_DOT,
  Assigned: WARNING_DOT,
  'In Rectification': PRIMARY_DOT,
  'For Verification': HOLD_DOT,
  Closed: SUCCESS_DOT,
  High: DANGER_DOT,
  Medium: WARNING_DOT,
  Low: NEUTRAL_DOT,
  Passed: SUCCESS_DOT,
  Failed: DANGER_DOT,
}

interface StatusBadgeProps {
  value: BadgeValue
  size?: 'sm' | 'md'
  withDot?: boolean
}

export default function StatusBadge({ value, size = 'md', withDot = true }: StatusBadgeProps) {
  const styles = STATUS_STYLES[value] ?? NEUTRAL
  const dot = DOT_STYLES[value] ?? NEUTRAL_DOT
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${sizeClasses} ${styles}`}
    >
      {withDot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {value}
    </span>
  )
}
