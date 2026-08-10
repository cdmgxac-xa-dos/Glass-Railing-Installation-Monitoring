import { useEffect, useState } from 'react'
import { getLocationById } from '../services/locationService'

// Resolves a location's human-facing reference label (e.g. 'AGD-001') for
// page headers — falls back to the raw :locationId until the location
// loads, or forever if it has none. For pages that show the ID in their
// header but don't otherwise need the full location record (Checklist,
// Photos, QC Inspection, Timeline, Notes).
export function useLocationReference(locationId: string): string {
  const [reference, setReference] = useState(locationId)

  useEffect(() => {
    setReference(locationId)
    getLocationById(locationId).then((location) => {
      if (location) setReference(location.reference ?? location.id)
    })
  }, [locationId])

  return reference
}
