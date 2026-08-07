import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UnitTypeSummary } from '../types'
import { getUnitTypesForFloor } from '../services/locationService'
import { useAppData } from '../context/DataContext'
import PageHeader from '../components/PageHeader'
import UnitTypeRow from '../components/UnitTypeRow'

export default function UnitTypeSelectionPage() {
  const navigate = useNavigate()
  const { selectedProjectCode, selectedFloor, setSelectedUnitType } = useAppData()
  const [unitTypes, setUnitTypes] = useState<UnitTypeSummary[]>([])

  useEffect(() => {
    if (!selectedProjectCode || !selectedFloor) {
      navigate('/floors')
      return
    }
    getUnitTypesForFloor(selectedProjectCode, selectedFloor).then(setUnitTypes)
  }, [selectedProjectCode, selectedFloor, navigate])

  function selectUnitType(summary: UnitTypeSummary) {
    if (summary.locationCount === 0) return
    setSelectedUnitType(summary.unitType)
    navigate('/locations')
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Select Unit Type" subtitle={`Floor ${selectedFloor ?? ''}`} />
      <div className="space-y-3 px-4 py-5">
        {unitTypes.map((ut) => (
          <UnitTypeRow
            key={ut.unitType}
            unitType={ut.unitType}
            locationCount={ut.locationCount}
            onClick={() => selectUnitType(ut)}
          />
        ))}
        <button
          onClick={() => {
            setSelectedUnitType(null)
            navigate('/locations')
          }}
          className="mt-2 w-full rounded-2xl border border-xa-line bg-white py-3 text-sm font-bold text-xa-blue shadow-card active:bg-xa-skyblue"
        >
          View all unit types on this floor
        </button>
        <button
          onClick={() => navigate('/floor-plan')}
          className="w-full rounded-2xl border border-xa-line bg-white py-3 text-sm font-bold text-xa-blue shadow-card active:bg-xa-skyblue"
        >
          View Floor Plan
        </button>
      </div>
    </div>
  )
}
