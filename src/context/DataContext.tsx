import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// Holds lightweight "where am I in the workflow" navigation state that
// several pages need (selected project / floor / unit type). This is UI
// state, not domain data — domain data always comes from the service layer.
interface DataContextValue {
  selectedProjectCode: string | null
  setSelectedProjectCode: (code: string | null) => void
  // Installation scope chosen for the current project (e.g. 'RAILING',
  // 'DOORS_WINDOWS' — see installation_scopes). Null until ScopeSelectionPage
  // resolves it, which happens automatically (no screen shown) whenever a
  // project only has data for one scope — true for every project today.
  selectedScope: string | null
  setSelectedScope: (scope: string | null) => void
  selectedFloor: string | null
  setSelectedFloor: (floor: string | null) => void
  selectedUnitType: string | null
  setSelectedUnitType: (unitType: string | null) => void
  clearSelection: () => void
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [selectedProjectCode, setSelectedProjectCode] = useState<string | null>(null)
  const [selectedScope, setSelectedScope] = useState<string | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [selectedUnitType, setSelectedUnitType] = useState<string | null>(null)

  function clearSelection() {
    setSelectedProjectCode(null)
    setSelectedScope(null)
    setSelectedFloor(null)
    setSelectedUnitType(null)
  }

  const value = useMemo(
    () => ({
      selectedProjectCode,
      setSelectedProjectCode,
      selectedScope,
      setSelectedScope,
      selectedFloor,
      setSelectedFloor,
      selectedUnitType,
      setSelectedUnitType,
      clearSelection,
    }),
    [selectedProjectCode, selectedScope, selectedFloor, selectedUnitType],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useAppData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useAppData must be used within DataProvider')
  return ctx
}
