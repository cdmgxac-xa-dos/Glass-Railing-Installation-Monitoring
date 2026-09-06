import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FloorSummary } from '../types'
import { getFloorsForProject } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import FloorButton from '../components/FloorButton'

// A plain numbered floor ("7th Floor", "12th Floor") groups as "Standard";
// anything else ("Ground Floor", "Roof Deck", a future "6F Mezzanine" or
// "Amenities" label) groups as "Special Areas" — assessment section 13's
// fix for the 3-column grid becoming awkward once labels stop being short
// and uniform.
const STANDARD_FLOOR_PATTERN = /^\d+(st|nd|rd|th)\s+floor$/i

export default function FloorSelectionPage() {
  const navigate = useNavigate()
  const { selectedProjectCode, setSelectedFloor } = useAppData()
  const [floors, setFloors] = useState<FloorSummary[]>([])

  useEffect(() => {
    if (!selectedProjectCode) {
      navigate('/projects')
      return
    }
    getFloorsForProject(selectedProjectCode).then(setFloors)
  }, [selectedProjectCode, navigate])

  function selectFloor(floor: FloorSummary) {
    if (floor.locationCount === 0) return
    setSelectedFloor(floor.floorLevel)
    navigate('/unit-types')
  }

  const standardFloors = floors.filter((f) => STANDARD_FLOOR_PATTERN.test(f.floorLevel))
  const specialFloors = floors.filter((f) => !STANDARD_FLOOR_PATTERN.test(f.floorLevel))

  return (
    <div className="min-h-screen bg-[#F5F7F8]">
      <PageHeader title="Select Floor" subtitle="Choose a floor to view railing locations" />

      {standardFloors.length > 0 && (
        <div className="px-4 pt-5">
          {specialFloors.length > 0 && (
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Standard Floors</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {standardFloors.map((floor) => (
              <FloorButton
                key={floor.floorLevel}
                floorLevel={floor.floorLevel}
                locationCount={floor.locationCount}
                onClick={() => selectFloor(floor)}
              />
            ))}
          </div>
        </div>
      )}

      {specialFloors.length > 0 && (
        <div className="px-4 pt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-xa-slate">Special Areas</p>
          <div className="grid grid-cols-2 gap-3">
            {specialFloors.map((floor) => (
              <FloorButton
                key={floor.floorLevel}
                floorLevel={floor.floorLevel}
                locationCount={floor.locationCount}
                onClick={() => selectFloor(floor)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
