import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ChevronLeft, RotateCw, Upload, X, Search, Trash2, Pencil, Eye, ZoomOut } from 'lucide-react'
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

// react-zoom-pan-pinch's panning/pinch/doubleClick "excluded" options match
// on this class name (verified against the installed package's actual
// implementation, not just its type defs — it does a DOM .matches() check,
// independent of React event propagation) so a touch/drag that starts on a
// pin never also starts a pan or pinch gesture underneath it. Kept as its
// own constant so the JSX class list and the TransformWrapper config can't
// drift out of sync.
const PIN_EXCLUDE_CLASS = 'floor-plan-pin'

// Landscape-and-wide counts as desktop-style even without a fine pointer —
// this is what lets a touch-only tablet (iPad) held in landscape skip the
// rotate prompt entirely, per the tablet revision to this spec.
const DESKTOP_LANDSCAPE_MIN_WIDTH = 768

function computeIsDesktopStyle(): boolean {
  if (typeof window === 'undefined') return false
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches
  const isPortraitNow = window.matchMedia('(orientation: portrait)').matches
  const isLandscapeWide = !isPortraitNow && window.innerWidth >= DESKTOP_LANDSCAPE_MIN_WIDTH
  return hasFinePointer || isLandscapeWide
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
  // Desktop-style = precise pointer available (mouse/trackpad, any screen
  // size — covers a tablet with a connected mouse) OR landscape on a screen
  // >=768px (covers a touch-only tablet in landscape, e.g. an iPad, without
  // ever showing the rotate prompt it doesn't need). Only phones — narrow
  // AND portrait, or narrow with no fine pointer — fall through to the
  // original forced-landscape mobile flow.
  const [isDesktopStyle, setIsDesktopStyle] = useState(computeIsDesktopStyle)

  const [picker, setPicker] = useState<{ xPct: number; yPct: number } | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [confirmDeletePinId, setConfirmDeletePinId] = useState<string | null>(null)
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null)
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false)
  // Measured pixel size of the available viewport area for the mobile
  // pinch/pan viewer. CSS percentage max-height doesn't reliably resolve
  // against an ancestor whose own height comes from shrink-wrapping its
  // content (the classic "percentage height needs a determinate ancestor
  // chain" gotcha) — measuring in JS and applying explicit pixel
  // maxWidth/maxHeight to the image sidesteps that entirely, and keeps the
  // image element's own bounding box tightly matching its visible content
  // (no object-fit letterboxing to account for), so pin xPct/yPct math
  // against imageRef stays correct at every zoom/pan level.
  const [mobileViewportSize, setMobileViewportSize] = useState<{ width: number; height: number } | null>(null)

  const imageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragPinIdRef = useRef<string | null>(null)
  // Latest dragged position, tracked in a ref rather than read back out of
  // `pins` state on pointerup — avoids any dependence on React having
  // flushed the in-progress drag's setPins before the save runs.
  const dragLatestPosRef = useRef<{ xPct: number; yPct: number } | null>(null)
  const mobileViewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedProjectCode || !selectedFloor) {
      navigate('/unit-types')
    }
  }, [selectedProjectCode, selectedFloor, navigate])

  // Measures the mobile viewer's available space so the image can be given
  // an explicit pixel maxWidth/maxHeight (see mobileViewportSize above).
  // useLayoutEffect, not useEffect, so the measurement is applied before
  // the browser paints — avoids a flash of oversized/cut-off image on
  // mount. ResizeObserver (not just the window resize listener elsewhere
  // in this file) because the CSS-rotation wrapper changes this element's
  // size without necessarily firing a window resize event.
  useLayoutEffect(() => {
    if (isDesktopStyle) return
    const el = mobileViewportRef.current
    if (!el) return
    const measure = () => setMobileViewportSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isDesktopStyle, isPortrait])

  // --- Forced landscape (phones only) + desktop-style detection --------
  // screen.orientation.lock() requires fullscreen on the browsers that
  // support it at all (mainly Android Chrome) and isn't supported on iOS
  // Safari, so it's attempted as a best-effort progressive enhancement —
  // the CSS-rotation wrapper below is what actually guarantees a landscape
  // view everywhere, and doesn't depend on any of this succeeding. Skipped
  // entirely when the device is already desktop-style (fine pointer, or a
  // wide landscape tablet) — requesting fullscreen on a device that never
  // needed the rotate prompt would just be disruptive.
  useEffect(() => {
    const orientationMq = window.matchMedia('(orientation: portrait)')
    const pointerMq = window.matchMedia('(pointer: fine)')
    const onOrientationChange = () => {
      setIsPortrait(orientationMq.matches)
      setIsDesktopStyle(computeIsDesktopStyle())
    }
    const onPointerChange = () => setIsDesktopStyle(computeIsDesktopStyle())
    const onResize = () => setIsDesktopStyle(computeIsDesktopStyle())
    orientationMq.addEventListener('change', onOrientationChange)
    pointerMq.addEventListener('change', onPointerChange)
    window.addEventListener('resize', onResize)

    async function tryLock() {
      if (computeIsDesktopStyle()) return
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
      orientationMq.removeEventListener('change', onOrientationChange)
      pointerMq.removeEventListener('change', onPointerChange)
      window.removeEventListener('resize', onResize)
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

  // Shared by the click-to-browse file input and desktop drag-and-drop —
  // both end up with a File and go through the identical upload path
  // (compression happens inside uploadFloorPlan() either way).
  async function handleFileUpload(file: File) {
    if (!selectedProjectCode || !selectedFloor) return
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

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFileUpload(file)
  }

  // Desktop-only affordance (Section 3) — dragging an image file onto the
  // upload area or the floor plan itself (while in edit mode, as a
  // re-upload). Harmless to leave wired on touch devices too since a real
  // OS-level file drag isn't a touch gesture; the visual highlight is what's
  // gated to isDesktopStyle, not the handler itself.
  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDraggingFileOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFileUpload(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!isDraggingFileOver) setIsDraggingFileOver(true)
  }

  function handleDragLeave() {
    setIsDraggingFileOver(false)
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
    // Belt-and-braces with TransformWrapper's own `excluded` option (which
    // matches on PIN_EXCLUDE_CLASS via DOM .matches(), independent of React
    // propagation): together these guarantee a touch starting on a pin never
    // also starts a pan/pinch underneath it.
    e.stopPropagation()
    dragPinIdRef.current = pinId
    dragLatestPosRef.current = null
    setDraggingPinId(pinId) // triggers the grabbing-cursor re-render; the ref alone drives the move/up logic
    // Best-effort only: keeps tracking the drag if the pointer slides off the
    // pin. Throws NotFoundError when the pointer isn't active, so it must
    // never be allowed to abort the drag.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // non-fatal — drag still works via the move/up handlers
    }
  }

  function handlePinPointerMove(e: React.PointerEvent) {
    const pinId = dragPinIdRef.current
    if (!pinId) return
    const pos = pctFromEvent(e.clientX, e.clientY)
    if (!pos) return
    dragLatestPosRef.current = pos
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, ...pos } : p)))
  }

  async function handlePinPointerUp(e: React.PointerEvent) {
    const pinId = dragPinIdRef.current
    const finalPos = dragLatestPosRef.current
    dragPinIdRef.current = null
    dragLatestPosRef.current = null
    setDraggingPinId(null)

    // Read everything needed for the save BEFORE releasing capture, and treat
    // the release as best-effort. releasePointerCapture throws NotFoundError
    // whenever the pointer is no longer active — a pointercancel, an
    // interrupted touch gesture, the browser reclaiming the gesture — all of
    // which are common on mobile. Letting that throw run ahead of the save
    // silently discarded the user's reposition.
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // non-fatal — nothing below depends on the capture being released
    }

    // No finalPos means a tap, not a drag — handlePinTap's onClick covers it.
    if (!pinId || !finalPos || !selectedProjectCode || !selectedFloor) return
    try {
      await updatePinPosition(pinId, finalPos.xPct, finalPos.yPct)
      // Pins-only cache refresh — the floor plan image itself is untouched
      // by a drag, so no need to touch that half of the cache entry. Rebuilt
      // from finalPos rather than trusting `pins` to already reflect the last
      // move in this same tick.
      updateCachedPins(
        selectedProjectCode,
        selectedFloor,
        pins.map((p) => (p.id === pinId ? { ...p, ...finalPos } : p)),
      )
    } catch (err) {
      console.error('Failed to save pin position:', err)
      setError('Failed to save pin position.')
    }
  }

  // A cancelled gesture (browser reclaiming the touch, pointer lost) must not
  // leave a stuck drag ref that makes the next stray pointermove reposition a
  // pin the user isn't touching.
  function handlePinPointerCancel() {
    dragPinIdRef.current = null
    dragLatestPosRef.current = null
    setDraggingPinId(null)
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

  // Shared between the desktop (plain) and mobile (pinch/pan-wrapped) render
  // paths — the image and every pin, unchanged by which wrapper it's inside.
  // Desktop scales to fit the max-w-5xl container width (native browser zoom
  // handles the rest); mobile scales to fit the TransformComponent's content
  // area, which is what "fit-to-screen at 1x" means for the reset control.
  function renderImageAndPins() {
    return (
      <>
        <img
          ref={imageRef}
          src={floorPlan!.imageUrl}
          alt={`${selectedFloor} floor plan`}
          onClick={handleImageClick}
          className={isDesktopStyle ? 'block h-auto w-full rounded-xl' : 'block w-auto h-auto rounded-xl'}
          style={
            isDesktopStyle
              ? {
                  touchAction: editMode ? 'none' : 'auto',
                  cursor: editMode && canManagePins ? 'crosshair' : undefined,
                }
              : {
                  // Explicit pixel bounds, not CSS percentages — see
                  // mobileViewportSize's definition for why. Falls back to
                  // a generous default before the first measurement lands
                  // (one layout-effect tick) so nothing renders enormous
                  // for a single frame.
                  maxWidth: mobileViewportSize?.width ?? 320,
                  maxHeight: mobileViewportSize?.height ?? 320,
                  touchAction: editMode ? 'none' : 'auto',
                }
          }
          draggable={false}
        />
        {isDesktopStyle && editMode && canManagePins && isDraggingFileOver && (
          <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-xl border-2 border-dashed border-xa-blue bg-xa-skyblue/50 text-sm font-bold text-xa-navy">
            Drop to replace this floor plan
          </div>
        )}
        {pins.map((pin) => {
          const loc = locationById.get(pin.locationId)
          const color = loc ? STATUS_COLORS[loc.status] : '#8A99A8'
          const canDrag = editMode && canManagePins
          return (
            <button
              key={pin.id}
              onPointerDown={(e) => handlePinPointerDown(e, pin.id)}
              onPointerMove={handlePinPointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerCancel}
              onClick={(e) => {
                e.stopPropagation()
                handlePinTap(pin)
              }}
              className={`${PIN_EXCLUDE_CLASS} absolute flex min-h-[32px] min-w-[32px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-md transition-transform ${
                isDesktopStyle ? 'hover:scale-110' : ''
              }`}
              style={{
                left: `${pin.xPct * 100}%`,
                top: `${pin.yPct * 100}%`,
                backgroundColor: color,
                touchAction: 'none',
                cursor: isDesktopStyle && canDrag ? (draggingPinId === pin.id ? 'grabbing' : 'grab') : undefined,
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
      </>
    )
  }

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

      <div ref={mobileViewportRef} className="relative flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-xa-slate">Loading…</div>
        ) : !floorPlan ? (
          <div
            className={`flex h-full flex-col items-center justify-center gap-3 p-6 text-center ${
              isDesktopStyle && isDraggingFileOver ? 'bg-xa-skyblue/40' : ''
            }`}
            onDragOver={isDesktopStyle && canManagePins ? handleDragOver : undefined}
            onDragLeave={isDesktopStyle && canManagePins ? handleDragLeave : undefined}
            onDrop={isDesktopStyle && canManagePins ? handleFileDrop : undefined}
          >
            {canManagePins ? (
              <>
                <Upload size={28} className="text-xa-blue" />
                <p className="text-sm font-semibold text-xa-navy">No floor plan uploaded yet</p>
                <p className="max-w-xs text-xs text-xa-slate">
                  {isDesktopStyle
                    ? "Drag and drop an image of this floor's layout here, or:"
                    : "Upload an image of this floor's layout so pins can be placed on it."}
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
        ) : isDesktopStyle ? (
          <div
            className="relative mx-auto max-w-5xl p-4"
            onDragOver={editMode && canManagePins ? handleDragOver : undefined}
            onDragLeave={editMode && canManagePins ? handleDragLeave : undefined}
            onDrop={editMode && canManagePins ? handleFileDrop : undefined}
          >
            {renderImageAndPins()}
          </div>
        ) : (
          // Mobile/forced-landscape: pinch-to-zoom + one-finger pan, via
          // react-zoom-pan-pinch (no existing zoom/pan dependency in this
          // codebase to reuse — checked package.json before adding it).
          // Pins are children of TransformComponent, not siblings positioned
          // independently, so their xPct/yPct-derived % positions stay
          // correct at any zoom/pan level automatically — same principle as
          // the earlier desktop position-locking fix (getBoundingClientRect
          // already accounts for ancestor transforms). Panning/pinch/
          // double-click all exclude PIN_EXCLUDE_CLASS so a touch starting
          // on a pin never also starts a pan or pinch underneath it —
          // verified against the installed package's actual match logic,
          // not just its type defs.
          <TransformWrapper
            initialScale={1}
            minScale={1}
            maxScale={4}
            limitToBounds
            centerOnInit
            doubleClick={{ mode: 'reset', disabled: editMode, excluded: [PIN_EXCLUDE_CLASS] }}
            panning={{ excluded: [PIN_EXCLUDE_CLASS] }}
            pinch={{ excluded: [PIN_EXCLUDE_CLASS] }}
          >
            {({ resetTransform }) => (
              <>
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!flex !h-full !w-full !items-center !justify-center"
                >
                  {/* inline-block, not w-full: shrink-wraps to the image's
                      actual measured size (see mobileViewportSize) so pin
                      xPct/yPct percentages resolve against the image's real
                      bounds, not a larger centering box. */}
                  <div className="relative inline-block">{renderImageAndPins()}</div>
                </TransformComponent>
                <button
                  onClick={() => resetTransform()}
                  aria-label="Reset zoom"
                  className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-2 text-xs font-bold text-white"
                >
                  <ZoomOut size={14} />
                  Reset zoom
                </button>
              </>
            )}
          </TransformWrapper>
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
  // actual physical orientation. Only applies to the phone case: not
  // desktop-style, and actually portrait right now. A phone already
  // rotated to landscape (narrow width, no fine pointer) falls through to
  // the plain branch below without rotating again; so does any
  // desktop-style device (fine pointer, or a wide landscape tablet) —
  // those never see the rotate prompt at all.
  if (!isDesktopStyle && isPortrait) {
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
