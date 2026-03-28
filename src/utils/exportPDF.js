import { jsPDF } from 'jspdf'
import { ACADEMIC_MONTHS } from '../hooks/useKeyboardNav.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel, parseDateKey } from './dateUtils.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SHA']
const COL_COUNT = 4
const PAGE_W = 297  // A4 landscape mm
const PAGE_H = 210
const MARGIN = 8
const SIDEBAR_W = 52
const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
const MONTH_W = (GRID_W / COL_COUNT) - 2
const MONTH_ROWS = 3
const MONTH_H = (PAGE_H - MARGIN * 2 - 20) / MONTH_ROWS - 3  // 20 = header height

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function drawMonth(doc, { year, month }, events, categories, x, y, w, h, shabbatLabel) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

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

    // SHA column bg
    if (dow === 6) {
      doc.setFillColor(232, 245, 250)
      doc.rect(cx, cy, cellW, cellH, 'F')
    }

    // Day number
    const dateKey = formatDateKey(date)
    const dayEvs = events[dateKey] || []
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(4)
    doc.text(String(dayNum), cx + 0.8, cy + 2.5)

    // Event dots
    dayEvs.slice(0, 3).forEach((ev, idx) => {
      const cat = catMap[ev.category]
      const color = ev.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.circle(cx + 1 + idx * 1.6, cy + cellH - 1.5, 0.6, 'F')
    })
  })

  // Notes strip
  const notesY = y + h - 6
  doc.setDrawColor(220, 220, 220)
  doc.line(x, notesY, x + w, notesY)

  // Collect events for notes
  const notesEvents = {}
  days.forEach(date => {
    const dateKey = formatDateKey(date)
    const dayEvs = events[dateKey] || []
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

export async function exportPDF(state) {
  const { events, categories, schoolInfo, settings } = state
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, PAGE_W, 16, 'F')

  if (schoolInfo.logo) {
    try { doc.addImage(schoolInfo.logo, 'PNG', MARGIN, 2, 12, 12) } catch {}
  }
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(schoolInfo.name || 'YAYOE Calendar', MARGIN + 14, 8)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text(`Academic Year 2026–2027  •  ${schoolInfo.phone || ''}`, MARGIN + 14, 12.5)

  // ── Draft Watermark ──────────────────────────────────
  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50)
    doc.setFontSize(60)
    doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.08 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1 }))
  }

  // ── Calendar Grid (4 columns × 3 rows = 12 months, we use 11) ──
  const startY = 18
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'

  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    const col = idx % COL_COUNT
    const row = Math.floor(idx / COL_COUNT)
    const x = MARGIN + col * (MONTH_W + 2)
    const y = startY + row * (MONTH_H + 3)
    drawMonth(doc, { year, month }, events, categories, x, y, MONTH_W, MONTH_H, shabbatLabel)
  })

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

  categories.filter(c => c.visible).forEach(cat => {
    const [r, g, b] = hexToRgb(cat.color)
    doc.setFillColor(r, g, b)
    doc.roundedRect(sbX + 2, legendY - 1.5, 3, 3, 0.5, 0.5, 'F')
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(4)
    doc.setFont('helvetica', 'normal')
    doc.text(cat.name, sbX + 6.5, legendY + 0.5, { maxWidth: SIDEBAR_W - 8 })
    legendY += 4.5
  })

  // Address block
  const addrY = PAGE_H - 20
  doc.setTextColor(80, 80, 80)
  doc.setFontSize(4)
  doc.setFont('helvetica', 'normal')
  if (schoolInfo.address) doc.text(schoolInfo.address, sbX + 2, addrY, { maxWidth: SIDEBAR_W - 4 })
  if (schoolInfo.phone) doc.text(`Tel: ${schoolInfo.phone}`, sbX + 2, addrY + 3)
  if (schoolInfo.fax) doc.text(`Fax: ${schoolInfo.fax}`, sbX + 2, addrY + 6)

  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-2026-27.pdf`)
}
