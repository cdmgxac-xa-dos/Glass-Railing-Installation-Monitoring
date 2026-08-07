import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  FloorPlan,
  LocationPhoto,
  LocationPin,
  ProjectDashboardSummary,
  QCInspectionRecord,
  RailingLocation,
  ReportConfig,
} from '../types'
import { QC_CHECKLIST_ITEMS } from '../types'
import { getLocationsByProject, getProjectDashboard } from '../services/locationService'
import { getQCRecordsForProject } from '../services/qcService'
import { getPunchListForProject } from '../services/punchListService'
import { getPhotosForLocation } from '../services/photoService'
import { getFloorPlan, getPinsForFloorPlan } from '../services/floorPlanService'
import { STATUS_COLORS, STATUS_ORDER } from '../constants/statusColors'

// Graphite gray — brand hex for the header banner and every table header row.
const GRAPHITE_HEX = '#5F6369'
const GRAPHITE_RGB: [number, number, number] = [0x5f, 0x63, 0x69]

const HEADER_LOGO_PAD_Y = 12 // pt, vertical padding above/below each right-side logo
const HEADER_LOGO_GAP = 10 // pt, gap between the two right-side logos
// 1.5x the original 46pt (46 = the old HEADER_HEIGHT(70) - pad(12)*2) —
// HEADER_HEIGHT is derived from this so the banner always grows to fit.
const HEADER_LOGO_HEIGHT = 69 // pt
const HEADER_HEIGHT = HEADER_LOGO_HEIGHT + HEADER_LOGO_PAD_Y * 2 // pt
const CONTENT_START_Y = HEADER_HEIGHT + 20 // first content Y on every page, below the banner

const GXAC_LOGO_URL = '/logo-gxac.png'
const SPINNAKER_LOGO_URL = '/logo-spinnaker.png'

// Thumbnail sizing shared by every photo column (Full Location Detail's
// Before/During/After columns and Punch List Detail's Photo column) — kept
// small on purpose per the "save paper space" request that replaced the old
// one-page-per-location photo appendix.
const THUMB_ROW_HEIGHT = 34 // pt, floor only — autoTable grows rows taller if wrapped text needs more room
const THUMB_PAD = 2

// Floor plan images can be large content diagrams (not simple logos), so
// this cap is higher than LOGO_MAX_DIMENSION below — still enough to keep
// pin labels legible at "2-3 per portrait page" scale without repeating the
// multi-MB bloat problem the unscaled logo embeds originally had.
const FLOOR_PLAN_MAX_DIMENSION = 1400 // px
const FLOOR_PLAN_PIN_RADIUS = 9 // px, at FLOOR_PLAN_MAX_DIMENSION scale

interface LogoAsset {
  dataUrl: string
  aspectRatio: number // natural width / natural height
  alias: string // passed to doc.addImage() so repeated draws across pages reuse one embedded XObject instead of re-embedding the full image data every time
}

interface HeaderContext {
  pageWidth: number
  summary: ProjectDashboardSummary
  generatedDate: Date
  gxacLogo: LogoAsset | null
  spinnakerLogo: LogoAsset | null
}

// Source logo files (GXAC_logo.png, Spinnaker_Logo.png) are 1536x1024 —
// far larger than a ~46pt header logo needs. Downscaling here keeps the
// generated PDF's file size sane; 400px is still well above what's needed
// for a crisp header logo even at high print DPI.
const LOGO_MAX_DIMENSION = 400 // px

// Fetches a public/ image once, downscales it, converts it to a data URL
// for doc.addImage(), and reads its aspect ratio so the header can scale it
// to a fixed height without distorting it. Returns null on any failure
// (missing file, decode error) rather than throwing — a report with a
// missing logo is still useful, a report that fails to generate isn't.
async function loadLogoAsset(url: string, alias: string): Promise<LogoAsset | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const aspectRatio = bitmap.width / bitmap.height

    const scale = Math.min(1, LOGO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    // Recolor the logo artwork to solid white, preserving its alpha shape —
    // the header banner is graphite, and the logos' original colors (GXAC's
    // red, Spinnaker's tan line art) don't read cleanly against it. 'source-in'
    // keeps only the alpha of what's already on the canvas (the logo's
    // silhouette) and fills it with the new color, so edges/anti-aliasing
    // stay intact — this is a pixel-level recolor, not a CSS filter.
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // PNG (not JPEG) to preserve the logo's transparent background.
    const dataUrl = canvas.toDataURL('image/png')
    return { dataUrl, aspectRatio, alias }
  } catch {
    return null
  }
}

export async function buildReportPdf(
  projectCode: string,
  config: ReportConfig,
): Promise<{ blob: Blob; title: string }> {
  const locations = await getLocationsByProject(projectCode)
  const summary = await getProjectDashboard(projectCode)
  const generatedDate = new Date()
  const title = `${summary.projectName.replace(/\s+/g, '_')}_Report_${generatedDate.toISOString().slice(0, 10)}`

  const [gxacLogo, spinnakerLogo] = await Promise.all([
    loadLogoAsset(GXAC_LOGO_URL, 'gxac-logo'),
    loadLogoAsset(SPINNAKER_LOGO_URL, 'spinnaker-logo'),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const header: HeaderContext = {
    pageWidth: doc.internal.pageSize.getWidth(),
    summary,
    generatedDate,
    gxacLogo,
    spinnakerLogo,
  }

  // Passed to every autoTable() call below so the banner repeats on every
  // page a table spans — including pages autoTable creates internally via
  // its own pagination, which our own newPage()/ensureSpace() helpers can't
  // reach since those only fire for page breaks we trigger ourselves.
  const didDrawPage = () => drawHeaderBanner(doc, header)

  drawHeaderBanner(doc, header)
  let cursorY = CONTENT_START_Y

  if (config.includeGeneralSummary) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('General Summary', 40, cursorY)
    cursorY += 16
    autoTable(doc, {
      startY: cursorY,
      head: [['Metric', 'Value']],
      body: [
        ['Overall Progress', `${summary.overallProgressPct}%`],
        ['Total Locations', `${locations.length}`],
        ...STATUS_ORDER.map((s) => [s, `${summary.statusCounts[s]}`]),
      ],
      theme: 'grid',
      headStyles: { fillColor: GRAPHITE_RGB },
      margin: { left: 40, right: 40 },
      didDrawPage,
    })
    cursorY = (doc as any).lastAutoTable.finalY + 24
  }

  if (config.includeByFloor) {
    cursorY = ensureSpace(doc, cursorY, header)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Accomplishment by Floor', 40, cursorY)
    cursorY += 16
    autoTable(doc, {
      startY: cursorY,
      head: [['Floor', 'Locations', ...STATUS_ORDER]],
      body: summary.byFloorStatus.map((f) => [
        f.floorLevel, `${f.locationCount}`, ...STATUS_ORDER.map((s) => `${f.statusCounts[s]}`),
      ]),
      theme: 'grid',
      headStyles: { fillColor: GRAPHITE_RGB },
      styles: { fontSize: 8 },
      margin: { left: 40, right: 40 },
      didDrawPage,
    })
    cursorY = (doc as any).lastAutoTable.finalY + 24
  }

  if (config.includeByStatus) {
    cursorY = ensureSpace(doc, cursorY, header)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Breakdown by Status', 40, cursorY)
    cursorY += 16
    autoTable(doc, {
      startY: cursorY,
      head: [['Status', 'Count', '% of Total']],
      body: STATUS_ORDER.map((s) => [
        s, `${summary.statusCounts[s]}`,
        locations.length ? `${Math.round((summary.statusCounts[s] / locations.length) * 100)}%` : '0%',
      ]),
      theme: 'grid',
      headStyles: { fillColor: GRAPHITE_RGB },
      margin: { left: 40, right: 40 },
      didDrawPage,
    })
    cursorY = (doc as any).lastAutoTable.finalY + 24
  }

  if (config.includeByUnitType) cursorY = groupedBreakdownTable(doc, cursorY, header, didDrawPage, 'Breakdown by Unit Type', locations, (l) => l.unitType)
  if (config.includeByBracketSystem) cursorY = groupedBreakdownTable(doc, cursorY, header, didDrawPage, 'Breakdown by Bracket System', locations, (l) => l.bracketSystem)
  if (config.includeByTeam) cursorY = groupedBreakdownTable(doc, cursorY, header, didDrawPage, 'Breakdown by Assigned Team', locations, (l) => l.assignedTeam)

  // Shared fetches: QC + punch-list data feeds both the per-location history
  // (inside Full Detail) and the standalone Punch List Detail table, so
  // fetch once rather than twice when both are checked.
  const needsQcPunchData = config.includeFullDetailQcPunchHistory || config.includeByPunchList
  const qcRecords = needsQcPunchData ? await getQCRecordsForProject(projectCode) : []
  const punchItems = needsQcPunchData ? await getPunchListForProject(projectCode) : []

  // Shared per-location photo cache. Punch List Detail's Photo column shows
  // the single most recent photo overall (`last`); Full Location Detail's
  // Before/During/After columns each show the most recent photo tagged
  // with that stage. Fetching each location's photos once and deriving all
  // four from that one array avoids redundant network round-trips when
  // both sections are checked.
  const needsPhotos = config.includeFullDetailPhotos || config.includeByPunchList
  const photosByLocation = new Map<string, LocationPhotoDataUrls>()
  if (needsPhotos) {
    await Promise.all(
      locations.map(async (l) => {
        photosByLocation.set(l.id, await getPhotoDataUrlsForLocation(l.id))
      }),
    )
  }

  if (config.includeByPunchList) {
    cursorY = newPage(doc, header)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Punch List Detail', 40, cursorY)
    cursorY += 16

    if (punchItems.length === 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('No punch list items recorded for this project.', 40, cursorY)
      cursorY += 20
    } else {
      // Most recent Failed QC inspection per location — punch items don't
      // carry a direct FK to the inspection that created them, so this is
      // the closest available match for "which checklist items failed".
      const latestFailedQcByLocation = new Map<string, QCInspectionRecord>()
      qcRecords
        .filter((r) => r.result === 'Failed')
        .sort((a, b) => new Date(a.inspectedAt).getTime() - new Date(b.inspectedAt).getTime())
        .forEach((r) => latestFailedQcByLocation.set(r.locationId, r))

      const photoColIndex = 6 // Floor, Tag ID, Unit, Status, Failed QC Item(s), Description, [Photo], Priority

      autoTable(doc, {
        startY: cursorY,
        head: [['Floor', 'Tag ID', 'Unit', 'Punch Status', 'Failed QC Item(s)', 'Issue Description', 'Photo', 'Priority']],
        body: punchItems.map((item) => {
          const loc = locations.find((l) => l.id === item.locationId)
          const failedQc = latestFailedQcByLocation.get(item.locationId)
          const failedItemLabels = failedQc
            ? QC_CHECKLIST_ITEMS.filter((d) => failedQc.itemResults[d.key] === false)
                .map((d) => d.label)
                .join(', ')
            : ''
          return [
            loc?.floorLevel ?? '',
            item.locationId,
            loc?.unitNo ?? '',
            item.status,
            failedItemLabels || '—',
            item.issueDescription,
            '',
            item.priority,
          ]
        }),
        theme: 'grid',
        headStyles: { fillColor: GRAPHITE_RGB },
        styles: { fontSize: 6.5, minCellHeight: THUMB_ROW_HEIGHT },
        columnStyles: { [photoColIndex]: { cellWidth: 40 } },
        margin: { left: 40, right: 40 },
        didDrawPage,
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== photoColIndex) return
          // Same rationale as Full Location Detail's photo columns: read
          // the Tag ID off the rendered row (column 1) rather than
          // indexing back into `punchItems` by data.row.index.
          const tagId = (data.row.raw as unknown[] | undefined)?.[1]
          if (typeof tagId !== 'string') return
          const dataUrl = photosByLocation.get(tagId)?.last
          if (!dataUrl) return
          drawThumbnail(doc, dataUrl, data.cell.x, data.cell.y, data.cell.width, data.cell.height)
        },
      })
      cursorY = (doc as any).lastAutoTable.finalY + 24
    }
  }

  if (config.includeFloorPlans) {
    // jsPDF can only embed static images, not live DOM — each floor's plan
    // + pins is rasterized to an offscreen canvas first, then embedded as
    // one PNG per floor. Statuses come from `locations`, fetched fresh at
    // the top of this function for this report run, not any cached value.
    const floorLevels = summary.byFloorStatus.map((f) => f.floorLevel)
    const rendered: { floorLevel: string; dataUrl: string; aspectRatio: number }[] = []
    for (const floorLevel of floorLevels) {
      const plan = await getFloorPlan(projectCode, floorLevel)
      if (!plan) continue // floors without an uploaded plan are silently skipped
      const pins = await getPinsForFloorPlan(plan.id)
      const canvasResult = await renderFloorPlanCanvas(plan, pins, locations)
      if (canvasResult) rendered.push({ floorLevel, ...canvasResult })
    }

    if (rendered.length > 0) {
      cursorY = newPage(doc, header)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Floor Plans', 40, cursorY)
      cursorY += 20

      // Legend drawn once for the whole section, not repeated per floor/page.
      cursorY = drawStatusLegend(doc, cursorY)

      const usableWidth = header.pageWidth - 80
      const pageHeight = doc.internal.pageSize.getHeight()
      for (const { floorLevel, dataUrl, aspectRatio } of rendered) {
        const imgHeight = usableWidth / aspectRatio
        const neededHeight = 18 + imgHeight + 16
        if (cursorY + neededHeight > pageHeight - 40) {
          cursorY = newPage(doc, header)
        }
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(20, 20, 20)
        doc.text(floorLevel, 40, cursorY)
        cursorY += 14
        doc.addImage(dataUrl, 'JPEG', 40, cursorY, usableWidth, imgHeight)
        cursorY += imgHeight + 16
      }
    }
  }

  if (config.includeFullDetail) {
    cursorY = newPage(doc, header)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Full Location Detail', 40, cursorY)
    cursorY += 16

    const detailHead = ['Tag ID', 'Floor', 'Unit', 'Status']
    if (config.includeFullDetailPhotos) detailHead.push('Before', 'During', 'After')
    const beforeColIndex = config.includeFullDetailPhotos ? detailHead.length - 3 : -1
    const duringColIndex = config.includeFullDetailPhotos ? detailHead.length - 2 : -1
    const afterColIndex = config.includeFullDetailPhotos ? detailHead.length - 1 : -1

    autoTable(doc, {
      startY: cursorY,
      head: [detailHead],
      body: locations.map((l) => {
        const row = [l.id, l.floorLevel, l.unitNo, l.status]
        if (config.includeFullDetailPhotos) row.push('', '', '') // drawn via didDrawCell below
        return row
      }),
      theme: 'grid',
      headStyles: { fillColor: GRAPHITE_RGB },
      styles: { fontSize: 7, minCellHeight: config.includeFullDetailPhotos ? THUMB_ROW_HEIGHT : undefined },
      columnStyles: config.includeFullDetailPhotos
        ? { [beforeColIndex]: { cellWidth: 40 }, [duringColIndex]: { cellWidth: 40 }, [afterColIndex]: { cellWidth: 40 } }
        : undefined,
      margin: { left: 40, right: 40 },
      didDrawPage,
      didDrawCell: (data) => {
        if (!config.includeFullDetailPhotos || data.section !== 'body') return
        const stage: keyof LocationPhotoDataUrls | null =
          data.column.index === beforeColIndex ? 'before'
          : data.column.index === duringColIndex ? 'during'
          : data.column.index === afterColIndex ? 'after'
          : null
        if (!stage) return
        // Read the Tag ID straight off the row autoTable actually rendered
        // (column 0) rather than trusting data.row.index to line up with
        // the source `locations` array — safer against autoTable's own
        // pagination/reflow indexing.
        const tagId = (data.row.raw as unknown[] | undefined)?.[0]
        if (typeof tagId !== 'string') return
        const dataUrl = photosByLocation.get(tagId)?.[stage]
        if (!dataUrl) return
        drawThumbnail(doc, dataUrl, data.cell.x, data.cell.y, data.cell.width, data.cell.height)
      },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 20

    if (config.includeFullDetailQcPunchHistory) {
      const qcByLocation = groupBy(qcRecords, (r) => r.locationId)
      const punchByLocation = groupBy(punchItems, (r) => r.locationId)

      for (const loc of locations) {
        const locQc = qcByLocation[loc.id] ?? []
        const locPunch = punchByLocation[loc.id] ?? []
        if (locQc.length === 0 && locPunch.length === 0) continue

        cursorY = ensureSpace(doc, cursorY, header)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text(`${loc.id} — QC & Punch List History`, 40, cursorY)
        cursorY += 12

        if (locQc.length > 0) {
          autoTable(doc, {
            startY: cursorY,
            head: [['Inspected At', 'Result', 'Inspected By']],
            body: locQc.map((r) => [new Date(r.inspectedAt).toLocaleDateString(), r.result ?? '', r.inspectedBy]),
            theme: 'striped', styles: { fontSize: 7 }, margin: { left: 50, right: 40 },
            didDrawPage,
          })
          cursorY = (doc as any).lastAutoTable.finalY + 8
        }
        if (locPunch.length > 0) {
          autoTable(doc, {
            startY: cursorY,
            head: [['Found', 'Priority', 'Status', 'Description']],
            body: locPunch.map((p) => [new Date(p.dateFound).toLocaleDateString(), p.priority, p.status, p.issueDescription]),
            theme: 'striped', styles: { fontSize: 7 }, margin: { left: 50, right: 40 },
            didDrawPage,
          })
          cursorY = (doc as any).lastAutoTable.finalY + 16
        }
      }
    }
  }

  return { blob: doc.output('blob'), title }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

// Fetches a floor plan image, downscales it, draws a colored dot + unit_no
// label for each pin (using each pin's linked location's CURRENT status —
// `locations` is fetched fresh at the top of buildReportPdf, not cached),
// and returns the result as a data URL ready for doc.addImage(). Returns
// null on any failure (missing/undecodable image) so one bad floor plan
// doesn't abort the rest of the report.
async function renderFloorPlanCanvas(
  plan: FloorPlan,
  pins: LocationPin[],
  locations: RailingLocation[],
): Promise<{ dataUrl: string; aspectRatio: number } | null> {
  try {
    const res = await fetch(plan.imageUrl)
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)

    const scale = Math.min(1, FLOOR_PLAN_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // White background first: this gets exported as JPEG (no alpha channel)
    // below, so any transparent edges in the source image would otherwise
    // flatten to black instead of white.
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const locationById = new Map(locations.map((l) => [l.id, l]))
    for (const pin of pins) {
      const loc = locationById.get(pin.locationId)
      const [r, g, b] = hexToRgb(loc ? STATUS_COLORS[loc.status] : '#8A99A8')
      const cx = pin.xPct * width
      const cy = pin.yPct * height

      ctx.beginPath()
      ctx.arc(cx, cy, FLOOR_PLAN_PIN_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#FFFFFF'
      ctx.stroke()

      if (loc) {
        ctx.font = 'bold 10px sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label = loc.unitNo.length > 6 ? `${loc.unitNo.slice(0, 5)}…` : loc.unitNo
        ctx.fillText(label, cx, cy)
      }
    }

    // JPEG (not PNG): the rasterized floor plan doesn't need alpha
    // transparency (unlike the logos), and jsPDF's PNG/alpha-channel embed
    // path was storing this as raw, uncompressed pixel data — a 1400x933
    // render came out well over 5MB per image. JPEG lets jsPDF pass through
    // the already-DCT-compressed stream directly instead of re-encoding raw
    // pixels, which is what the logos' PNG path also needed (alpha), but
    // this render doesn't.
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), aspectRatio: width / height }
  } catch {
    return null
  }
}

// Small color-swatch + status-name legend, drawn once per report (not once
// per floor or per page) right below the "Floor Plans" section heading.
function drawStatusLegend(doc: jsPDF, cursorY: number): number {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  let x = 40
  STATUS_ORDER.forEach((status) => {
    const [r, g, b] = hexToRgb(STATUS_COLORS[status])
    doc.setFillColor(r, g, b)
    doc.circle(x + 3, cursorY - 3, 3, 'F')
    doc.setTextColor(60, 60, 60)
    doc.text(status, x + 10, cursorY)
    x += doc.getTextWidth(status) + 26
  })
  doc.setTextColor(20, 20, 20)
  return cursorY + 16
}

// Draws a photo data URL into an autoTable cell rect, centered and clamped
// to fit — used by both the Full Detail and Punch List Detail photo columns.
function drawThumbnail(doc: jsPDF, dataUrl: string, cellX: number, cellY: number, cellWidth: number, cellHeight: number): void {
  const h = cellHeight - THUMB_PAD * 2
  const w = Math.min(h * 1.33, cellWidth - THUMB_PAD * 2)
  try {
    doc.addImage(dataUrl, 'JPEG', cellX + THUMB_PAD, cellY + THUMB_PAD, w, h)
  } catch {
    // skip malformed/undecodable images rather than aborting the whole report
  }
}

interface LocationPhotoDataUrls {
  last: string | null // most recent photo overall — Punch List Detail's Photo column
  before: string | null // most recent 'Before' photo — Full Location Detail
  during: string | null // most recent 'During' photo — Full Location Detail
  after: string | null // most recent 'After' photo — Full Location Detail
}

// Fetches a location's photos once and derives all four values needed by
// the report's photo columns from that single array, rather than issuing a
// separate fetch per stage.
async function getPhotoDataUrlsForLocation(locationId: string): Promise<LocationPhotoDataUrls> {
  const photos = await getPhotosForLocation(locationId)
  const lastOf = (category?: LocationPhoto['category']): LocationPhoto | null => {
    const matches = category ? photos.filter((p) => p.category === category) : photos
    return matches.length > 0 ? matches[matches.length - 1] : null
  }
  const toDataUrl = async (photo: LocationPhoto | null): Promise<string | null> => {
    if (!photo) return null
    try {
      return await urlToDataUrl(photo.previewUrl)
    } catch {
      return null
    }
  }
  const [last, before, during, after] = await Promise.all([
    toDataUrl(lastOf()),
    toDataUrl(lastOf('Before')),
    toDataUrl(lastOf('During')),
    toDataUrl(lastOf('After')),
  ])
  return { last, before, during, after }
}

// Draws the repeating title banner (logo, report title, project + generated
// date) at the top of the current page. Called once for the first page and
// again via didDrawPage on every autoTable() call so it repeats on every
// page a table spans, including pages autoTable paginates internally.
function drawHeaderBanner(
  doc: jsPDF,
  { pageWidth, summary, generatedDate, gxacLogo, spinnakerLogo }: HeaderContext,
): void {
  doc.setFillColor(...GRAPHITE_RGB)
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('XA', 40, 30)
  doc.setTextColor(91, 158, 245)
  doc.text('A', 40 + doc.getTextWidth('X'), 30)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text('Glass Railing Installation Report', 40, 50)
  doc.setFontSize(9)
  doc.text(`${summary.projectName} — Generated ${generatedDate.toLocaleString()}`, 40, 63)

  // GXAC and Spinnaker logos, right side of the banner, side by side.
  // Each is scaled to HEADER_LOGO_HEIGHT with its own aspect ratio
  // preserved — not a fixed box — so neither logo looks stretched
  // regardless of its native proportions. Laid out right-to-left from the
  // page's right margin: Spinnaker outermost (closest to the edge), GXAC
  // just inside it.
  const logoHeight = HEADER_LOGO_HEIGHT
  let logoRightEdge = pageWidth - 40
  if (spinnakerLogo) {
    const w = logoHeight * spinnakerLogo.aspectRatio
    doc.addImage(spinnakerLogo.dataUrl, 'PNG', logoRightEdge - w, HEADER_LOGO_PAD_Y, w, logoHeight, spinnakerLogo.alias)
    logoRightEdge -= w + HEADER_LOGO_GAP
  }
  if (gxacLogo) {
    const w = logoHeight * gxacLogo.aspectRatio
    doc.addImage(gxacLogo.dataUrl, 'PNG', logoRightEdge - w, HEADER_LOGO_PAD_Y, w, logoHeight, gxacLogo.alias)
  }

  doc.setTextColor(20, 20, 20)
}

// Starts a new page and immediately redraws the header banner on it, for
// page breaks we trigger ourselves (section headers, ensureSpace overflow).
function newPage(doc: jsPDF, header: HeaderContext): number {
  doc.addPage()
  drawHeaderBanner(doc, header)
  return CONTENT_START_Y
}

function ensureSpace(doc: jsPDF, cursorY: number, header: HeaderContext): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (cursorY + 60 > pageHeight - 40) return newPage(doc, header)
  return cursorY
}

function groupedBreakdownTable<T>(
  doc: jsPDF,
  cursorY: number,
  header: HeaderContext,
  didDrawPage: () => void,
  heading: string,
  locations: T[],
  keyFn: (l: T) => string,
): number {
  const counts = new Map<string, number>()
  locations.forEach((l) => counts.set(keyFn(l), (counts.get(keyFn(l)) ?? 0) + 1))
  cursorY = ensureSpace(doc, cursorY, header)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(heading, 40, cursorY)
  cursorY += 16
  autoTable(doc, {
    startY: cursorY,
    head: [['Category', 'Count']],
    body: Array.from(counts.entries()).map(([k, v]) => [k, `${v}`]),
    theme: 'grid', headStyles: { fillColor: GRAPHITE_RGB }, margin: { left: 40, right: 40 },
    didDrawPage,
  })
  return (doc as any).lastAutoTable.finalY + 24
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item)
    ;(acc[key] ??= []).push(item)
    return acc
  }, {} as Record<string, T[]>)
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
