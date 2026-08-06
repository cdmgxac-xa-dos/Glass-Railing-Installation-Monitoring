import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { TimelineEvent } from '../types'
import { getTimelineForLocation } from '../services/timelineService'
import PageHeader from '../components/PageHeader'
import TimelineItem from '../components/TimelineItem'

export default function TimelinePage() {
  const { locationId = '' } = useParams()
  const [events, setEvents] = useState<TimelineEvent[]>([])

  useEffect(() => {
    getTimelineForLocation(locationId).then(setEvents)
  }, [locationId])

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Timeline" subtitle={locationId} />
      <div className="px-4 py-5">
        {events.length === 0 && <p className="py-10 text-center text-sm text-xa-slate">No activity recorded yet.</p>}
        {events.map((event, i) => (
          <TimelineItem key={event.id} event={event} isLast={i === events.length - 1} />
        ))}
      </div>
    </div>
  )
}
