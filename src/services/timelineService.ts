import type { TimelineEvent } from '../types'
import { MOCK_TIMELINE } from '../data/mockData'

const store: TimelineEvent[] = [...MOCK_TIMELINE]
let counter = 1

export async function getTimelineForLocation(locationId: string): Promise<TimelineEvent[]> {
  return store
    .filter((e) => e.locationId === locationId)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
}

export async function addTimelineEvent(event: Omit<TimelineEvent, 'id'>): Promise<TimelineEvent> {
  const full: TimelineEvent = { ...event, id: `EVT-${Date.now()}-${counter++}` }
  store.push(full)
  return full
}
