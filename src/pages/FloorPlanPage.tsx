import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, RotateCw, Upload, X, Search, Trash2, Pencil, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/DataContext'
import type { FloorPlan, LocationPin, RailingLocation } from '../types'
import {
  getFloorPlanCached,
  setFloorPlanCache,
  updateCachedPins,
  uploadFloorPlan,
  getPinsForFloorPlan,
  createPin,
  updatePinPosition,
  deletePin,
} from '../services/floorPlanService'
import { getLocationsByProject } from '../services/locationService'
import { STATUS_COLORS } from '../constants/statusColors'

// Independent of gr_can_write()/field_ops edit level on purpose (mirrors the
// DB's gr_can_manage_pins()) — Owner stays view-only here even though Owner
// has other field_ops access elsewhere. Checked against roleCode (the real
// DB role_code), not the app's collapsed UserRole, since qc_officer/
// field_pic/safety_officer all present as the same UserRole ('QC Inspector')
// but only qc_officer and field_pic manage pins.
const PIN_MANAGER_ROLE_CODES = ['field_pic', 'projects', 'qc_officer']

// Pin label is the unit_no, not the internal location id — field teams
// think in unit numbers. Real gr_locations.unit_no data is 4 chars (e.g.
// "10-A"); this cap is generous headroom above that for any future/mock
// data that runs longer, so it degrades gracefully instead of overflowing
// the small pin.
const PIN_LABEL_MAX = 6

function pinLabel(unitNo: string): string {
  return unitNo.length <= PIN_LABEL_MAX ? unitNo : `${unitNo.slice(0, PIN_LABEL_MAX - 1)}…`
}

export default function FloorPlanPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedProjectCode, selectedFloor } = useAppData()

  const canManagePins = user?.roleCode ? PIN_MANAGER_ROLE_CODES.includes(user.roleCode) : false

  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null)
  const [pins, setPins] = useState<LocationPin[]>([])
  const [locations, setLocations] = useState<RailingLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const [isPortrait, setIsPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches,
  )

  const [picker, setPicker] = useState<{ xPct: number; yPct: number } | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [confirmDeletePinId, setConfirmDeletePinId] = useState<string | null>(null)

  const imageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragPinIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedProjectCode || !selectedFloor) {
      navigate('/unit-types')
    }
  }, [selectedProjectCode, selectedFloor, navigate])

  // --- Forced landscape ------------------------------------------------
  // screen.orientation.lock() requires fullscreen on the browsers that
  // support it at all (mainly Android Chrome) and isn't supported on iOS
  // Safari, so it's attempted as a best-effort progressive enhancement —
  // the CSS-rotation wrapper below is what actually guarantees a landscape
  // view everywhere, and doesn't depend on any of this succeeding.
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const onChange = () => setIsPortrait(mq.matches)
    mq.addEventListener('change', onChange)

    async function tryLock() {
      try {
        const el = document.documentElement
        if (el.requestFullscreen) await el.requestFullscreen()
        const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined
        await orientation?.lock?.('landscape')
      } catch {
        // Expected to fail on iOS Safari and outside a user gesture on many
        // browsers — the CSS fallback below covers this page regardless.
      }
    }
    tryLock()

    return () => {
      mq.removeEventListener('change', onChange)
      try {
        const orientation = screen.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined
        orientation?.unlock?.()
      } catch {
        // no-op
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedProjectCode || !selectedFloor) return
    setLoading(true)
    setError('')
    // getFloorPlanCached resolves immediately (no network call) if this
    // project+floor was already loaded earlier in the session — only the
    // location list (status data, changes frequently) is always fetched
    // fresh, never cached.
    Promise.all([
      getFloorPlanCached(selectedProjectCode, selectedFloor),
      getLocationsByProject(selectedProjectCode),
    ])
      .then(([entry, allLocations]) => {
        setFloorPlan(entry?.floorPlan ?? null)
        setPins(entry?.pins ?? [])
        setLocations(allLocations.filter((l) => l.floorLevel === selectedFloor))
      })
      .catch((err: unknown) => {
        console.error('Failed to load floor plan:', err)
        setError(err instanceof Error ? err.message : 'Failed to load floor plan.')
      })
      .finally(() => setLoading(false))
  }, [selectedProjectCode, selectedFloor])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedProjectCode || !selectedFloor) return
    setError('')
    setUploading(true)
    try {
      const plan = await uploadFloorPlan(selectedProjectCode, selectedFloor, file, user?.name ?? 'Unknown')
      const freshPins = await getPinsForFloorPlan(plan.id)
      setFloorPlan(plan)
      setPins(freshPins)
      // Explicit re-upload is the one case that should replace the cached
      // image — everything else (mount, navigation) should keep using it.
      setFloorPlanCache(selectedProjectCode, selectedFloor, plan, freshPins)
    } catch (err) {
      console.error('Floor plan upload failed:', err)
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  function pctFromEvent(clientX: number, clientY: number): { xPct: number; yPct: number } | null {
    const rect = imageRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    const xPct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const yPct = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    return { xPct, yPct }
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!editMode || !canManagePins) return
    const pos = pctFromEvent(e.clientX, e.clientY)
    if (pos) {
      setPickerQuery('')
      setPicker(pos)
    }
  }

  function handlePinTap(pin: LocationPin) {
    if (editMode) {
      setConfirmDeletePinId((cur) => (cur === pin.id ? null : pin.id))
      return
    }
    navigate(`/locations/${pin.locationId}`)
  }

  // Pointer Events unify mouse + touch under one API — there's no existing
  // touch-drag pattern elsewhere in this app to mirror (photo capture just
  // uses a native file input), so this is the standard modern choice for
  // drag-to-reposition that works on both desktop and mobile.
  function handlePinPointerDown(e: React.PointerEvent, pinId: string) {
    if (!editMode) return
    e.stopPropagation()
    dragPinIdRef.current = pinId
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePinPointerMove(e: React.PointerEvent) {
    const pinId = dragPinIdRef.current
    if (!pinId) return
    const pos = pctFromEvent(e.clientX, e.clientY)
    if (!pos) return
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, ...pos } : p)))
  }

  async function handlePinPointerUp(e: React.PointerEvent) {
    const pinId = dragPinIdRef.current
    dragPinIdRef.current = null
    if (!pinId) return
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    const pin = pins.find((p) => p.id === pinId)
    if (!pin || !selectedProjectCode || !selectedFloor) return
    try {
      await updatePinPosition(pin.id, pin.xPct, pin.yPct)
      // Pins-only cache refresh — the floor plan image itself is untouched
      // by a drag, so no need to touch that half of the cache entry.
      updateCachedPins(selectedProjectCode, selectedFloor, pins)
    } catch (err) {
      console.error('Failed to save pin position:', err)
      setError('Failed to save pin position.')
    }
  }

  async function handlePickerSelect(location: RailingLocation) {
    if (!picker || !floorPlan || !selectedProjectCode || !selectedFloor) return
    setError('')
    try {
      const pin = await createPin(floorPlan.id, location.id, picker.xPct, picker.yPct, user?.name ?? 'Unknown')
      const nextPins = [...pins, pin]
      setPins(nextPins)
      updateCachedPins(selectedProjectCode, selectedFloor, nextPins)
      setPicker(null)
    } catch (err) {
      console.error('Failed to place pin:', err)
      setError('Failed to place pin. That location may already have one.')
    }
  }

  async function handleConfirmDelete(pinId: string) {
    if (!selectedProjectCode || !selectedFloor) return
    setError('')
    try {
      await deletePin(pinId)
      const nextPins = pins.filter((p) => p.id !== pinId)
      setPins(nextPins)
      updateCachedPins(selectedProjectCode, selectedFloor, nextPins)
      setConfirmDeletePinId(null)
    } catch (err) {
      console.error('Failed to delete pin:', err)
      setError('Failed to delete pin.')
    }
  }

  const pinnedLocationIds = useMemo(() => new Set(pins.map((p) => p.locationId)), [pins])
  const locationById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations])

  const pickerResults = useMemo(() => {
    const unpinned = locations.filter((l) => !pinnedLocationIds.has(l.id))
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return unpinned
    const byUnitNo = unpinned.filter((l) => l.unitNo.toLowerCase().includes(q))
    if (byUnitNo.length > 0) return byUnitNo
    return unpinned.filter((l) => l.id.toLowerCase().includes(q))
  }, [locations, pinnedLocationIds, pickerQuery])

  const content = (
    <div className="relative flex h-full w-full flex-col bg-[#F5F8FC]">
      <header className="flex shrink-0 items-center gap-2 bg-xa-navy px-3 py-2 text-white">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full active:bg-white/10"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold leading-tight">Floor Plan</h1>
          <p className="truncate text-[11px] text-blue-100">{selectedFloor}</p>
        </div>
        {canManagePins && floorPlan && (
          <button
            onClick={() => {
              setEditMode((v) => !v)
              setConfirmDeletePinId(null)
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              editMode ? 'bg-white text-xa-navy' : 'bg-white/10 text-white'
            }`}
          >
            {editMode ? <Eye size={14} /> : <Pencil size={14} />}
            {editMode ? 'Done' : 'Edit Pins'}
          </button>
        )}
      </header>

      {error && (
        <p className="shrink-0 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">{error}</p>
      )}

      <div className="relative flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-xa-slate">Loading…</div>
        ) : !floorPlan ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            {canManagePins ? (
              <>
                <Upload size={28} className="text-xa-blue" />
                <p className="text-sm font-semibold text-xa-navy">No floor plan uploaded yet</p>
                <p className="max-w-xs text-xs text-xa-slate">
                  Upload an image of this floor's layout so pins can be placed on it.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 rounded-xl bg-xa-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : 'Upload Floor Plan'}
                </button>
              </>
            ) : (
              <p className="text-sm text-xa-slate">Floor plan not yet available for this floor.</p>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
          </div>
        ) : (
          <div className="relative inline-block min-h-full min-w-full">
            <img
              ref={imageRef}
              src={floorPlan.imageUrl}
              alt={`${selectedFloor} floor plan`}
              onClick={handleImageClick}
              className="block max-w-none"
              style={{ touchAction: editMode ? 'none' : 'auto' }}
              draggable={false}
            />
            {pins.map((pin) => {
              const loc = locationById.get(pin.locationId)
              const color = loc ? STATUS_COLORS[loc.status] : '#8A99A8'
              return (
                <button
                  key={pin.id}
                  onPointerDown={(e) => handlePinPointerDown(e, pin.id)}
                  onPointerMove={handlePinPointerMove}
                  onPointerUp={handlePinPointerUp}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePinTap(pin)
                  }}
                  className="absolute flex min-h-[32px] min-w-[32px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-md"
                  style={{
                    left: `${pin.xPct * 100}%`,
                    top: `${pin.yPct * 100}%`,
                    backgroundColor: color,
                    touchAction: 'none',
                  }}
                >
                  {loc ? pinLabel(loc.unitNo) : '?'}
                  {editMode && confirmDeletePinId === pin.id && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConfirmDelete(pin.id)
                      }}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white"
                    >
                      <Trash2 size={12} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {floorPlan && canManagePins && editMode && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-3 right-3 rounded-xl bg-xa-navy/90 px-3 py-2 text-xs font-bold text-white shadow-pop disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : 'Re-upload Plan'}
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
      </div>

      {picker && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/40" onClick={() => setPicker(null)}>
          <div
            className="mt-auto max-h-[70%] rounded-t-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-xa-navy">Place pin — select a location</p>
              <button onClick={() => setPicker(null)} aria-label="Close">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-xa-line px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search unit no. (e.g. 10-A)"
                className="w-full text-sm outline-none"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {pickerResults.length === 0 ? (
                <p className="py-4 text-center text-xs text-xa-slate">No unpinned locations match.</p>
              ) : (
                pickerResults.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handlePickerSelect(loc)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-semibold text-xa-navy">{loc.unitNo}</span>
                    <span className="text-xs text-xa-slate">{loc.id}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // The CSS-rotation wrapper is the primary landscape mechanism (works
  // everywhere, including iOS Safari where screen.orientation.lock() isn't
  // supported at all) — it rotates the content 90° and swaps width/height
  // so it fills the viewport in landscape shape regardless of the device's
  // actual physical orientation. When the device is already landscape (a
  // tablet, or a successful orientation lock), no rotation is applied.
  if (isPortrait) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F5F8FC]">
        <div
          className="fixed left-0 top-0 origin-top-left overflow-hidden"
          style={{
            width: '100vh',
            height: '100vw',
            transform: 'rotate(90deg) translateY(-100%)',
          }}
        >
          {content}
        </div>
        <div className="pointer-events-none fixed inset-x-0 top-3 z-10 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
            <RotateCw size={14} />
            Rotate your device for the best view
          </div>
        </div>
      </div>
    )
  }

  return <div className="fixed inset-0 z-50">{content}</div>
}
