import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FloorSummary } from '../types'
import { getFloorsForProject } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import FloorButton from '../components/FloorButton'

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

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Select Floor" subtitle="Choose a floor to view railing locations" />
      <div className="grid grid-cols-3 gap-3 px-4 py-5">
        {floors.map((floor) => (
          <FloorButton
            key={floor.floorLevel}
            floorLevel={floor.floorLevel}
            locationCount={floor.locationCount}
            onClick={() => selectFloor(floor)}
          />
        ))}
      </div>
    </div>
  )
}
