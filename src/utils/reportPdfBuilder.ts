import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportConfig } from '../types'
import { getLocationsByProject, getProjectDashboard } from '../services/locationService'
import { getQCRecordsForProject } from '../services/qcService'
import { getPunchListForProject } from '../services/punchListService'
import { getPhotosForLocation } from '../services/photoService'
import { STATUS_ORDER } from '../constants/statusColors'

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

  if (config.includeFullDetail) {
    doc.addPage()
    cursorY = 40
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Full Location Detail', 40, cursorY)
    cursorY += 16

    const qcRecords = config.includeFullDetailQcPunchHistory ? await getQCRecordsForProject(projectCode) : []
    const punchItems = config.includeFullDetailQcPunchHistory ? await getPunchListForProject(projectCode) : []

    autoTable(doc, {
      startY: cursorY,
      head: [['Tag ID', 'Floor', 'Unit', 'Status', 'Team', 'LM', 'Panels']],
      body: locations.map((l) => [l.id, l.floorLevel, l.unitNo, l.status, l.assignedTeam, `${l.totalLinearMeters}`, `${l.totalGlassPanels}`]),
      theme: 'grid',
      headStyles: { fillColor: [10, 20, 40] },
      styles: { fontSize: 7 },
      margin: { left: 40, right: 40 },
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

    if (config.includeFullDetailPhotos) {
      for (const loc of locations) {
        const photos = await getPhotosForLocation(loc.id)
        if (photos.length === 0) continue

        doc.addPage()
        cursorY = 40
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(`${loc.id} — Photos (${photos.length})`, 40, cursorY)
        cursorY += 20

        let x = 40
        for (const photo of photos) {
          try {
            const dataUrl = await urlToDataUrl(photo.previewUrl)
            doc.addImage(dataUrl, 'JPEG', x, cursorY, 120, 90)
          } catch {
            // skip photos that fail to load rather than aborting the whole report
          }
          x += 130
          if (x > pageWidth - 160) { x = 40; cursorY += 100 }
          if (cursorY > 700) { doc.addPage(); cursorY = 40; x = 40 }
        }
      }
    }
  }

  return { blob: doc.output('blob'), title }
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
