import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { TimelineEvent } from '../types'
import { getTimelineForLocation } from '../services/timelineService'
import { useLocationReference } from '../hooks/useLocationReference'
import PageHeader from '../components/PageHeader'
import TimelineItem from '../components/TimelineItem'

export default function TimelinePage() {
  const { locationId = '' } = useParams()
  const reference = useLocationReference(locationId)
  const [events, setEvents] = useState<TimelineEvent[]>([])

  useEffect(() => {
    getTimelineForLocation(locationId).then(setEvents)
  }, [locationId])

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Timeline" subtitle={reference} />
      <div className="px-4 py-5">
        {events.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-xa-navy">No activity recorded yet</p>
            <p className="mt-1 text-xs text-xa-slate">
              Status changes, QC inspections, punch items, and photo uploads for this location will show up here.
            </p>
          </div>
        )}
        {events.map((event, i) => (
          <TimelineItem key={event.id} event={event} isLast={i === events.length - 1} />
        ))}
      </div>
    </div>
  )
}
