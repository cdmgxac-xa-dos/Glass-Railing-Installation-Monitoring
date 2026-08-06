import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// Holds lightweight "where am I in the workflow" navigation state that
// several pages need (selected project / floor / unit type). This is UI
// state, not domain data — domain data always comes from the service layer.
interface DataContextValue {
  selectedProjectCode: string | null
  setSelectedProjectCode: (code: string | null) => void
  selectedFloor: string | null
  setSelectedFloor: (floor: string | null) => void
  selectedUnitType: string | null
  setSelectedUnitType: (unitType: string | null) => void
  clearSelection: () => void
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [selectedProjectCode, setSelectedProjectCode] = useState<string | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [selectedUnitType, setSelectedUnitType] = useState<string | null>(null)

  function clearSelection() {
    setSelectedProjectCode(null)
    setSelectedFloor(null)
    setSelectedUnitType(null)
  }

  const value = useMemo(
    () => ({
      selectedProjectCode,
      setSelectedProjectCode,
      selectedFloor,
      setSelectedFloor,
      selectedUnitType,
      setSelectedUnitType,
      clearSelection,
    }),
    [selectedProjectCode, selectedFloor, selectedUnitType],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useAppData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useAppData must be used within DataProvider')
  return ctx
}
