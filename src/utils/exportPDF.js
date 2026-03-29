import { jsPDF } from 'jspdf'
import { ACADEMIC_MONTHS } from '../hooks/useKeyboardNav.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel } from './dateUtils.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'
import { ROSH_CHODESH_MAP } from '../data/hebrewCalendar.js'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SHA']
const COL_COUNT = 4
const PAGE_W = 297  // A4 landscape mm
const PAGE_H = 210
const MARGIN = 8
const SIDEBAR_W = 52

function hexToRgb(hex) {
  const clean = (hex || '#999999').replace('#', '').padEnd(6, '9')
  const r = parseInt(clean.slice(0, 2), 16) || 153
  const g = parseInt(clean.slice(2, 4), 16) || 153
  const b = parseInt(clean.slice(4, 6), 16) || 153
  return [r, g, b]
}

// Lighter version of a color for subtle fills
function lightenRgb([r, g, b], amount = 0.55) {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ]
}

function drawMonth(doc, { year, month }, events, categories, settings, x, y, w, h, shabbatLabel) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })
  const isFilled = settings.cellStyle === 'filled'

  // Month header
  doc.setFillColor(30, 58, 95)
  doc.roundedRect(x, y, w, 6, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
  const hebrewLabel = getHebrewMonthLabel(year, month)
  doc.text(`${monthName} ${year}`, x + 1, y + 2.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.text(hebrewLabel, x + 1, y + 4.8, { maxWidth: w - 2 })

  // Day header row
  const dayLabelY = y + 7.5
  const cellW = w / 7
  DAYS.forEach((d, i) => {
    const labelStr = i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d
    if (i === 6) {
      doc.setFillColor(46, 134, 171, 0.15)
      doc.rect(x + i * cellW, dayLabelY - 2, cellW, 3, 'F')
    }
    doc.setTextColor(i === 6 ? 46 : 80, i === 6 ? 134 : 80, i === 6 ? 171 : 80)
    doc.setFontSize(3.8)
    doc.setFont('helvetica', 'bold')
    doc.text(labelStr, x + i * cellW + cellW / 2, dayLabelY, { align: 'center' })
  })

  // Day cells
  const days = getDaysInMonth(year, month)
  const startDow = getFirstDayOfWeek(year, month)
  const cellH = (h - 11) / 6
  doc.setFont('helvetica', 'normal')

  days.forEach(date => {
    const dayNum = date.getDate()
    const dow = (startDow + dayNum - 1) % 7
    const weekRow = Math.floor((startDow + dayNum - 1) / 7)
    const cx = x + dow * cellW
    const cy = dayLabelY + 2 + weekRow * cellH
    const dateKey = formatDateKey(date)
    const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
    const rcMonth = ROSH_CHODESH_MAP[dateKey]

    // Shabbat background (dot mode only)
    if (dow === 6 && !isFilled) {
      doc.setFillColor(232, 245, 250)
      doc.rect(cx, cy, cellW, cellH, 'F')
    }

    if (isFilled && dayEvs.length > 0) {
      // Filled cell mode — color the whole cell
      const firstEv = dayEvs[0]
      const cat = catMap[firstEv.category]
      const color = firstEv.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.roundedRect(cx + 0.2, cy + 0.2, cellW - 0.4, cellH - 0.4, 0.5, 0.5, 'F')
      // Day number in white
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(4)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, cy + 2.5)
      doc.setFont('helvetica', 'normal')
    } else {
      // Dot mode — day number + dots
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(4)
      doc.text(String(dayNum), cx + 0.8, cy + 2.5)
      dayEvs.slice(0, 3).forEach((ev, idx) => {
        const cat = catMap[ev.category]
        const color = ev.color || cat?.color || '#999999'
        const [r, g, b] = hexToRgb(color)
        doc.setFillColor(r, g, b)
        doc.circle(cx + 1 + idx * 1.6, cy + cellH - 1.5, 0.6, 'F')
      })
    }

    // Rosh Chodesh badge — shown in all modes
    if (rcMonth) {
      doc.setFontSize(2.8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(isFilled && dayEvs.length > 0 ? 230 : 120, isFilled && dayEvs.length > 0 ? 200 : 100, isFilled && dayEvs.length > 0 ? 255 : 180)
      doc.text(`R.Ch. ${rcMonth}`, cx + 0.5, cy + cellH - 0.5, { maxWidth: cellW - 1 })
      doc.setFont('helvetica', 'normal')
    }
  })

  // Notes strip (when eventsPanel === 'inline')
  if (settings.eventsPanel !== 'bottom') {
    const notesY = y + h - 6
    doc.setDrawColor(220, 220, 220)
    doc.line(x, notesY, x + w, notesY)

    const notesEvents = {}
    days.forEach(date => {
      const dateKey = formatDateKey(date)
      const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
      dayEvs.forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        if (!notesEvents[key]) notesEvents[key] = { ev, dates: [] }
        notesEvents[key].dates.push(dateKey)
      })
    })

    let noteLineY = notesY + 2
    doc.setFontSize(3.2)
    Object.values(notesEvents).slice(0, 4).forEach(({ ev, dates }) => {
      const cat = catMap[ev.category]
      const color = ev.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.circle(x + 1, noteLineY - 0.5, 0.5, 'F')
      const groups = groupConsecutiveDates(dates)
      const rangeStr = groups.map(g => formatRangeLabel(g)).join(', ')
      doc.setTextColor(60, 60, 60)
      doc.text(`${rangeStr} | ${ev.label}`, x + 2.5, noteLineY, { maxWidth: w - 3 })
      noteLineY += 1.8
    })
  }
}

function drawBottomEventsPanel(doc, events, categories, y, pageW, margin) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const panelH = pageW  // will calculate based on content
  const panelY = y
  const panelW = pageW - margin * 2

  // Panel background
  doc.setFillColor(15, 45, 61)
  doc.roundedRect(margin, panelY, panelW, 28, 2, 2, 'F')

  // Header
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(5)
  doc.setFont('helvetica', 'bold')
  doc.text('EVENTS BY MONTH', margin + 3, panelY + 4)

  // Month columns
  const colW = panelW / ACADEMIC_MONTHS.length
  const MONTH_ABBR = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']

  ACADEMIC_MONTHS.forEach(({ year, month }, mi) => {
    const colX = margin + mi * colW
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

    // Column header
    doc.setFillColor(255, 255, 255, 0.1)
    doc.setTextColor(180, 210, 255)
    doc.setFontSize(4.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`${MONTH_ABBR[mi]} '${String(year).slice(2)}`, colX + 1, panelY + 8)

    // Events list
    const monthEvs = {}
    Object.entries(events).forEach(([dk, evs]) => {
      if (!dk.startsWith(monthKey)) return
      ;(evs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        if (!monthEvs[key]) monthEvs[key] = { ev, dates: [] }
        monthEvs[key].dates.push(dk)
      })
    })

    let evY = panelY + 11
    doc.setFontSize(3)
    doc.setFont('helvetica', 'normal')
    Object.values(monthEvs).sort((a, b) => a.dates[0].localeCompare(b.dates[0])).slice(0, 6).forEach(({ ev, dates }) => {
      const cat = catMap[ev.category]
      const color = ev.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.circle(colX + 1.2, evY - 0.5, 0.7, 'F')
      const groups = groupConsecutiveDates([...dates].sort())
      const rangeStr = groups.map(g => formatRangeLabel(g)).join(', ')
      doc.setTextColor(200, 220, 240)
      doc.text(`${rangeStr} ${ev.label}`, colX + 2.5, evY, { maxWidth: colW - 3.5 })
      evY += 3.2
    })
  })
}

export async function exportPDF(state) {
  const { events, categories, schoolInfo, settings } = state
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'
  const showBottomPanel = settings.eventsPanel === 'bottom'

  // Layout measurements
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / COL_COUNT) - 2
  const MONTH_ROWS = 3
  const availH = showBottomPanel
    ? PAGE_H - MARGIN * 2 - 20 - 32  // 32 = bottom panel height
    : PAGE_H - MARGIN * 2 - 20
  const MONTH_H = availH / MONTH_ROWS - 3

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, PAGE_W, 16, 'F')

  // Logo (circular mask via clipping)
  if (schoolInfo.logo) {
    try {
      doc.addImage(schoolInfo.logo, 'PNG', MARGIN, 2, 12, 12)
    } catch {}
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(schoolInfo.name || 'YAYOE Calendar', MARGIN + 14, 8)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text(`Academic Year ${settings.academicYear || '2026–2027'}  •  ${schoolInfo.phone || ''}`, MARGIN + 14, 12.5)

  // ── Draft Watermark ──────────────────────────────────
  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50)
    doc.setFontSize(60)
    doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.08 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1 }))
  }

  // ── Calendar Grid ──────────────────────────────────
  const startY = 18

  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    const col = idx % COL_COUNT
    const row = Math.floor(idx / COL_COUNT)
    const x = MARGIN + col * (MONTH_W + 2)
    const y = startY + row * (MONTH_H + 3)
    drawMonth(doc, { year, month }, events, categories, settings, x, y, MONTH_W, MONTH_H, shabbatLabel)
  })

  // ── Bottom Events Panel ──────────────────────────────
  if (showBottomPanel) {
    const panelTop = startY + MONTH_ROWS * (MONTH_H + 3) + 2
    drawBottomEventsPanel(doc, events, categories, panelTop, PAGE_W, MARGIN)
  }

  // ── Sidebar ──────────────────────────────────────────
  const sbX = PAGE_W - MARGIN - SIDEBAR_W
  doc.setFillColor(248, 249, 250)
  doc.rect(sbX, 18, SIDEBAR_W, PAGE_H - 20, 'F')
  doc.setDrawColor(220, 220, 220)
  doc.rect(sbX, 18, SIDEBAR_W, PAGE_H - 20)

  doc.setTextColor(30, 58, 95)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text('SCHOOL HOURS', sbX + 2, 23)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.setTextColor(60, 60, 60)
  if (schoolInfo.hours) {
    doc.text(schoolInfo.hours, sbX + 2, 27, { maxWidth: SIDEBAR_W - 4 })
  }

  // Legend
  let legendY = 55
  doc.setTextColor(30, 58, 95)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text('LEGEND', sbX + 2, legendY)
  legendY += 3

  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').forEach(cat => {
    const [r, g, b] = hexToRgb(cat.color)
    doc.setFillColor(r, g, b)
    doc.roundedRect(sbX + 2, legendY - 1.5, 3, 3, 0.5, 0.5, 'F')
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(4)
    doc.setFont('helvetica', 'normal')
    doc.text(cat.name, sbX + 6.5, legendY + 0.5, { maxWidth: SIDEBAR_W - 8 })
    legendY += 4.5
  })

  // RC legend note
  doc.setFontSize(3.5)
  doc.setTextColor(120, 100, 180)
  doc.text('🌙 = Rosh Chodesh (informational)', sbX + 2, legendY + 1, { maxWidth: SIDEBAR_W - 4 })

  // Address block
  const addrY = PAGE_H - 20
  doc.setTextColor(80, 80, 80)
  doc.setFontSize(4)
  doc.setFont('helvetica', 'normal')
  if (schoolInfo.address) doc.text(schoolInfo.address, sbX + 2, addrY, { maxWidth: SIDEBAR_W - 4 })
  if (schoolInfo.phone) doc.text(`Tel: ${schoolInfo.phone}`, sbX + 2, addrY + 3)
  if (schoolInfo.fax) doc.text(`Fax: ${schoolInfo.fax}`, sbX + 2, addrY + 6)

  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}.pdf`)
}
