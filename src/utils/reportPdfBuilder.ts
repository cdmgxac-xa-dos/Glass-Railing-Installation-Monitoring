import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { QCInspectionRecord, ReportConfig } from '../types'
import { QC_CHECKLIST_ITEMS } from '../types'
import { getLocationsByProject, getProjectDashboard } from '../services/locationService'
import { getQCRecordsForProject } from '../services/qcService'
import { getPunchListForProject } from '../services/punchListService'
import { getPhotosForLocation } from '../services/photoService'
import { STATUS_ORDER } from '../constants/statusColors'

// Thumbnail sizing shared by both photo-column tables (Full Location Detail
// and Punch List Detail) — kept small on purpose per the "save paper space"
// request that replaced the old one-page-per-location photo appendix.
const THUMB_ROW_HEIGHT = 34 // pt, floor only — autoTable grows rows taller if wrapped text needs more room
const THUMB_PAD = 2

export async function buildReportPdf(
  projectCode: string,
  config: ReportConfig,
): Promise<{ blob: Blob; title: string }> {
  const locations = await getLocationsByProject(projectCode)
  const summary = await getProjectDashboard(projectCode)
  const generatedDate = new Date()
  const title = `${summary.projectName.replace(/\s+/g, '_')}_Report_${generatedDate.toISOString().slice(0, 10)}`

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let cursorY = 90

  doc.setFillColor(10, 20, 40)
  doc.rect(0, 0, pageWidth, 70, 'F')
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
  doc.setTextColor(20, 20, 20)

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
      headStyles: { fillColor: [10, 20, 40] },
      margin: { left: 40, right: 40 },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 24
  }

  if (config.includeByFloor) {
    cursorY = ensureSpace(doc, cursorY)
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
      headStyles: { fillColor: [10, 20, 40] },
      styles: { fontSize: 8 },
      margin: { left: 40, right: 40 },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 24
  }

  if (config.includeByStatus) {
    cursorY = ensureSpace(doc, cursorY)
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
      headStyles: { fillColor: [10, 20, 40] },
      margin: { left: 40, right: 40 },
    })
    cursorY = (doc as any).lastAutoTable.finalY + 24
  }

  if (config.includeByUnitType) cursorY = groupedBreakdownTable(doc, cursorY, 'Breakdown by Unit Type', locations, (l) => l.unitType)
  if (config.includeByBracketSystem) cursorY = groupedBreakdownTable(doc, cursorY, 'Breakdown by Bracket System', locations, (l) => l.bracketSystem)
  if (config.includeByTeam) cursorY = groupedBreakdownTable(doc, cursorY, 'Breakdown by Assigned Team', locations, (l) => l.assignedTeam)

  // Shared fetches: QC + punch-list data feeds both the per-location history
  // (inside Full Detail) and the standalone Punch List Detail table, so
  // fetch once rather than twice when both are checked.
  const needsQcPunchData = config.includeFullDetailQcPunchHistory || config.includeByPunchList
  const qcRecords = needsQcPunchData ? await getQCRecordsForProject(projectCode) : []
  const punchItems = needsQcPunchData ? await getPunchListForProject(projectCode) : []

  // Shared last-photo-per-location cache: both the Full Detail photo column
  // and the Punch List Detail photo column show only the single most recent
  // photo per location (not a gallery) — this is what keeps the report
  // compact instead of burning a page per location like the old appendix did.
  const needsPhotos = config.includeFullDetailPhotos || config.includeByPunchList
  const photoDataUrlByLocation = new Map<string, string | null>()
  if (needsPhotos) {
    await Promise.all(
      locations.map(async (l) => {
        photoDataUrlByLocation.set(l.id, await getLastPhotoDataUrl(l.id))
      }),
    )
  }

  if (config.includeByPunchList) {
    doc.addPage()
    cursorY = 40
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
        headStyles: { fillColor: [10, 20, 40] },
        styles: { fontSize: 6.5, minCellHeight: THUMB_ROW_HEIGHT },
        columnStyles: { [photoColIndex]: { cellWidth: 40 } },
        margin: { left: 40, right: 40 },
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== photoColIndex) return
          // Same rationale as Full Location Detail's photo column: read the
          // Tag ID off the rendered row (column 1) rather than indexing
          // back into `punchItems` by data.row.index.
          const tagId = (data.row.raw as unknown[] | undefined)?.[1]
          if (typeof tagId !== 'string') return
          const dataUrl = photoDataUrlByLocation.get(tagId)
          if (!dataUrl) return
          drawThumbnail(doc, dataUrl, data.cell.x, data.cell.y, data.cell.width, data.cell.height)
        },
      })
      cursorY = (doc as any).lastAutoTable.finalY + 24
    }
  }

  if (config.includeFullDetail) {
    doc.addPage()
    cursorY = 40
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Full Location Detail', 40, cursorY)
    cursorY += 16

    const detailHead = ['Tag ID', 'Floor', 'Unit', 'Status', 'Team', 'LM', 'Panels']
    if (config.includeFullDetailPhotos) detailHead.push('Photo')
    const photoColIndex = detailHead.length - 1

    autoTable(doc, {
      startY: cursorY,
      head: [detailHead],
      body: locations.map((l) => {
        const row = [l.id, l.floorLevel, l.unitNo, l.status, l.assignedTeam, `${l.totalLinearMeters}`, `${l.totalGlassPanels}`]
        if (config.includeFullDetailPhotos) row.push('') // drawn via didDrawCell below
        return row
      }),
      theme: 'grid',
      headStyles: { fillColor: [10, 20, 40] },
      styles: { fontSize: 7, minCellHeight: config.includeFullDetailPhotos ? THUMB_ROW_HEIGHT : undefined },
      columnStyles: config.includeFullDetailPhotos ? { [photoColIndex]: { cellWidth: 40 } } : undefined,
      margin: { left: 40, right: 40 },
      didDrawCell: (data) => {
        if (!config.includeFullDetailPhotos) return
        if (data.section !== 'body' || data.column.index !== photoColIndex) return
        // Read the Tag ID straight off the row autoTable actually rendered
        // (column 0) rather than trusting data.row.index to line up with
        // the source `locations` array — safer against autoTable's own
        // pagination/reflow indexing.
        const tagId = (data.row.raw as unknown[] | undefined)?.[0]
        if (typeof tagId !== 'string') return
        const dataUrl = photoDataUrlByLocation.get(tagId)
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

        cursorY = ensureSpace(doc, cursorY)
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
          })
          cursorY = (doc as any).lastAutoTable.finalY + 8
        }
        if (locPunch.length > 0) {
          autoTable(doc, {
            startY: cursorY,
            head: [['Found', 'Priority', 'Status', 'Description']],
            body: locPunch.map((p) => [new Date(p.dateFound).toLocaleDateString(), p.priority, p.status, p.issueDescription]),
            theme: 'striped', styles: { fontSize: 7 }, margin: { left: 50, right: 40 },
          })
          cursorY = (doc as any).lastAutoTable.finalY + 16
        }
      }
    }
  }

  return { blob: doc.output('blob'), title }
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

// Last (most recently uploaded) photo for a location, converted to a data
// URL for embedding — only one per location, not a full gallery, per the
// "save paper space" request this replaced the old photo-appendix pages with.
async function getLastPhotoDataUrl(locationId: string): Promise<string | null> {
  const photos = await getPhotosForLocation(locationId)
  if (photos.length === 0) return null
  try {
    return await urlToDataUrl(photos[photos.length - 1].previewUrl)
  } catch {
    return null
  }
}

function ensureSpace(doc: jsPDF, cursorY: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (cursorY + 60 > pageHeight - 40) { doc.addPage(); return 40 }
  return cursorY
}

function groupedBreakdownTable<T>(doc: jsPDF, cursorY: number, heading: string, locations: T[], keyFn: (l: T) => string): number {
  const counts = new Map<string, number>()
  locations.forEach((l) => counts.set(keyFn(l), (counts.get(keyFn(l)) ?? 0) + 1))
  cursorY = ensureSpace(doc, cursorY)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(heading, 40, cursorY)
  cursorY += 16
  autoTable(doc, {
    startY: cursorY,
    head: [['Category', 'Count']],
    body: Array.from(counts.entries()).map(([k, v]) => [k, `${v}`]),
    theme: 'grid', headStyles: { fillColor: [10, 20, 40] }, margin: { left: 40, right: 40 },
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
