import { jsPDF } from 'jspdf'
import { loadMontserrat } from './pdfFonts.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel } from './dateUtils.js'

import { getAcademicMonths } from './academicMonths.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'
import { getRoshChodeshMap, getHolidayMap } from '../data/hebrewCalendar.js'
import { getTheme, hexToRgb } from './themeUtils.js'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SHA']
const COL_COUNT = 4
const PAGE_W = 297  // A4 landscape mm
const PAGE_H = 210
const MARGIN = 8
const SIDEBAR_W = 52
const HEADER_H = 18
const BOTTOM_PANEL_H = 38

function hexToRgbLocal(hex) {
  return hexToRgb(hex)
}

const DEFAULT_SIDEBAR_BLOCKS = [
  { id: 'hours',     visible: true },
  { id: 'legend',    visible: true },
  { id: 'otherInfo', visible: true },
  { id: 'contact',   visible: true },
]

// Renders one sidebar block and returns the next Y position.
// colors: { pr, pg, pb, ar, ag, ab, textRgb, linkRgb } — lets dark/light themes reuse same helper
function renderSidebarBlock(doc, blockId, startY, { sbX, sbCx, SIDEBAR_W, ruleW, pr, pg, pb, ar, ag, ab, textRgb, linkRgb, schoolInfo, categories }) {
  const [tr, tg, tb] = textRgb || [60, 70, 90]
  const [lr, lg, lb] = linkRgb || [42, 100, 180]
  let y = startY

  switch (blockId) {
    case 'hours': {
      const hourLines = (schoolInfo.hours || '').split('\n').filter(l => l.trim())
      if (!hourLines.length) return y
      doc.setTextColor(pr, pg, pb); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text('SCHOOL HOURS', sbCx, y, { align: 'center' })
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbCx - ruleW / 2, y + 1.8, sbCx + ruleW / 2, y + 1.8)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(tr, tg, tb)
      hourLines.forEach((line, i) => doc.text(line.trim(), sbCx, y + 7 + i * 5.5, { align: 'center' }))
      y += 7 + hourLines.length * 5.5 + 4
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbX + 3, y, sbX + SIDEBAR_W - 3, y)
      return y + 6
    }
    case 'legend': {
      const visibleCats = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
      if (!visibleCats.length) return y
      doc.setTextColor(pr, pg, pb); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text('LEGEND', sbCx, y, { align: 'center' })
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbCx - ruleW / 2, y + 1.8, sbCx + ruleW / 2, y + 1.8)
      y += 6
      visibleCats.forEach((cat, idx) => {
        const [r, g, b] = hexToRgbLocal(cat.color || '#999')
        const itemY = y + idx * 5.5
        doc.setFillColor(r, g, b); doc.rect(sbX + 5, itemY - 2.5, 5, 3.2, 'F')
        doc.setTextColor(tr, tg, tb); doc.setFontSize(5); doc.setFont('helvetica', 'normal')
        doc.text(cat.name, sbX + 12, itemY, { maxWidth: SIDEBAR_W - 14 })
      })
      y += visibleCats.length * 5.5 + 4
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbX + 3, y, sbX + SIDEBAR_W - 3, y)
      return y + 6
    }
    case 'otherInfo': {
      if (!schoolInfo.otherInfo) return y
      doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(schoolInfo.otherInfo, SIDEBAR_W - 6).slice(0, 4)
      doc.setTextColor(tr, tg, tb)
      lines.forEach((line, i) => doc.text(line, sbCx, y + i * 5, { align: 'center' }))
      y += lines.length * 5 + 4
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbX + 3, y, sbX + SIDEBAR_W - 3, y)
      return y + 6
    }
    case 'contact': {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.setTextColor(tr, tg, tb)
      if (schoolInfo.address) { doc.text(schoolInfo.address, sbCx, y, { align: 'center', maxWidth: SIDEBAR_W - 6 }); y += 5 }
      if (schoolInfo.phone) { doc.text(`Tel: ${schoolInfo.phone}`, sbCx, y, { align: 'center' }); y += 4.5 }
      if (schoolInfo.fax) { doc.text(`Fax: ${schoolInfo.fax}`, sbCx, y, { align: 'center' }); y += 4.5 }
      if (schoolInfo.email) { doc.setTextColor(lr, lg, lb); doc.text(schoolInfo.email, sbCx, y, { align: 'center', maxWidth: SIDEBAR_W - 6 }); doc.setTextColor(tr, tg, tb); y += 4.5 }
      if (schoolInfo.website) { doc.setTextColor(lr, lg, lb); doc.text(schoolInfo.website, sbCx, y, { align: 'center', maxWidth: SIDEBAR_W - 6 }) }
      return y
    }
    default: return y
  }
}

// Crop/shape a logo image using canvas. shape: 'circle' | 'square' | 'rounded'
async function cropLogoImage(base64, shape = 'circle') {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (shape === 'circle') {
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.clip()
      } else if (shape === 'rounded') {
        const r = size * 0.15
        ctx.beginPath()
        ctx.moveTo(r, 0); ctx.lineTo(size - r, 0); ctx.arcTo(size, 0, size, r, r)
        ctx.lineTo(size, size - r); ctx.arcTo(size, size, size - r, size, r)
        ctx.lineTo(r, size); ctx.arcTo(0, size, 0, size - r, r)
        ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r)
        ctx.closePath(); ctx.clip()
      }
      // 'square' — no clip, draw as-is
      ctx.drawImage(img, 0, 0, size, size)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(base64)
    img.src = base64
  })
}

function drawMonth(doc, { year, month }, events, categories, settings, x, y, w, h, shabbatLabel, notesStripH, theme) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })
  const isFilled = settings.cellStyle === 'filled'
  const isCompact = settings.template === 'compact'
  const s = isCompact ? 0.82 : 1  // scale factor for compact mode
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const [sr, sg, sb] = hexToRgbLocal(theme.shabbatBg || '#e1e8f2')

  // Month header
  const headerH = 8 * s
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(x, y, w, headerH, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7 * s)
  doc.setFont('helvetica', 'bold')
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
  const hebrewLabel = getHebrewMonthLabel(year, month)
  doc.text(monthName, x + 1.5, y + 3.8 * s)
  const monthNameW = doc.getTextWidth(monthName)
  doc.setTextColor(ar, ag, ab)
  doc.setFontSize(6.5 * s)
  doc.text(` ${String(year)}`, x + 1.5 + monthNameW, y + 3.8 * s)
  doc.setTextColor(180, 210, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4 * s)
  if (!isCompact) doc.text(hebrewLabel, x + 1.5, y + 6.5, { maxWidth: w - 3 })

  // Day header row
  const dayLabelY = y + (isCompact ? 7.5 : 9.5)
  const cellW = w / 7
  DAYS.forEach((d, i) => {
    const labelStr = i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d
    if (i === 6) {
      doc.setFillColor(sr, sg, sb)
      doc.rect(x + i * cellW, dayLabelY - 2, cellW, 3 * s, 'F')
    }
    doc.setTextColor(i === 6 ? pr : 80, i === 6 ? pg : 80, i === 6 ? pb : 80)
    doc.setFontSize(3.8 * s)
    doc.setFont('helvetica', 'bold')
    doc.text(labelStr, x + i * cellW + cellW / 2, dayLabelY, { align: 'center' })
  })

  // Day cells
  const days = getDaysInMonth(year, month)
  const startDow = getFirstDayOfWeek(year, month)
  const headerOffset = isCompact ? 9 : 11
  const cellH = (h - headerOffset - (notesStripH || 0)) / 6
  doc.setFont('helvetica', 'normal')

  days.forEach(date => {
    const dayNum = date.getDate()
    const dow = (startDow + dayNum - 1) % 7
    const weekRow = Math.floor((startDow + dayNum - 1) / 7)
    const cx = x + dow * cellW
    const cy = dayLabelY + 2 + weekRow * cellH
    const dateKey = formatDateKey(date)
    const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
    const rcMonth = getRoshChodeshMap(settings.academicYear)[dateKey]
    const hebrewHoliday = getHolidayMap(settings.academicYear)[dateKey]

    // Shabbat background — always apply theme tint first
    if (dow === 6) {
      doc.setFillColor(sr, sg, sb)
      doc.rect(cx, cy, cellW, cellH, 'F')
    }

    if (isFilled && dayEvs.length > 0) {
      // Filled cell mode — color the whole cell with the first event's color
      const firstEv = dayEvs[0]
      const cat = catMap[firstEv.category]
      const color = firstEv.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.roundedRect(cx + 0.2, cy + 0.2, cellW - 0.4, cellH - 0.4, 0.5, 0.5, 'F')
      // Day number in white
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(4 * s)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, cy + 2.5 * s)
      // Event label below day number
      if (cellH > 7 && firstEv.label) {
        doc.setFontSize(2.8 * s)
        doc.setFont('helvetica', 'normal')
        const lbl = firstEv.label.length > 12 ? firstEv.label.slice(0, 11) + '…' : firstEv.label
        doc.text(lbl, cx + 0.8, cy + 2.5 * s + 2.8 * s, { maxWidth: cellW - 1.2 })
      }
      doc.setFont('helvetica', 'normal')
    } else {
      // Dot mode — day number + colored dot + tiny label
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(4 * s)
      doc.text(String(dayNum), cx + 0.8, cy + 2.5 * s)
      dayEvs.slice(0, 2).forEach((ev, evIdx) => {
        const cat = catMap[ev.category]
        const color = ev.color || cat?.color || '#999999'
        const [r, g, b] = hexToRgb(color)
        const dotY = cy + 3.8 * s + evIdx * 2.8 * s
        // Color dot
        doc.setFillColor(r, g, b)
        doc.circle(cx + 1, dotY, 0.65 * s, 'F')
        // Event label next to dot
        if (ev.label && cellW > 8) {
          doc.setFontSize(2.6 * s)
          doc.setTextColor(r, g, b)
          const lbl = ev.label.length > 11 ? ev.label.slice(0, 10) + '…' : ev.label
          doc.text(lbl, cx + 2.4, dotY + 0.5, { maxWidth: cellW - 2.8 })
        }
      })
    }

    // Cell border — thin faint line around every day cell
    doc.setDrawColor(200, 200, 205)
    doc.setLineWidth(0.15)
    doc.rect(cx, cy, cellW, cellH, 'S')

    // Rosh Chodesh badge
    if (rcMonth) {
      doc.setFontSize(2.8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(isFilled && dayEvs.length > 0 ? 230 : 120, isFilled && dayEvs.length > 0 ? 200 : 100, isFilled && dayEvs.length > 0 ? 255 : 180)
      doc.text(`R.Ch. ${rcMonth}`, cx + 0.5, cy + cellH - (hebrewHoliday ? 2.2 : 0.5), { maxWidth: cellW - 1 })
      doc.setFont('helvetica', 'normal')
    }
    // Hebrew holiday badge
    if (hebrewHoliday && settings.hebrewHolidayToggles?.[hebrewHoliday.group] !== false) {
      const customIcons = settings.hebrewHolidayIcons || {}
      const icon = customIcons[hebrewHoliday.group] || hebrewHoliday.icon
      const isAshkenaz = settings.shabbatLabel === 'Shabbos'
      const hName = isAshkenaz ? hebrewHoliday.ashkenaz : hebrewHoliday.sephardi
      doc.setFontSize(2.8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(isFilled && dayEvs.length > 0 ? 255 : 160, isFilled && dayEvs.length > 0 ? 230 : 120, isFilled && dayEvs.length > 0 ? 100 : 20)
      doc.text(`${icon} ${hName}`, cx + 0.5, cy + cellH - 0.5, { maxWidth: cellW - 1 })
    }
  })

  // Notes strip (when eventsPanel === 'inline')
  if (settings.eventsPanel !== 'bottom' && notesStripH > 0) {
    const stripH = notesStripH
    const notesY = y + h - stripH
    // Light background so text is readable over cell colors
    doc.setFillColor(248, 249, 251)
    doc.rect(x, notesY, w, stripH, 'F')
    doc.setDrawColor(200, 205, 215)
    doc.setLineWidth(0.2)
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

    const maxNoteY = y + h - 0.5
    let noteLineY = notesY + 2.5
    doc.setFontSize(3.2)
    for (const { ev, dates } of Object.values(notesEvents)) {
      if (noteLineY > maxNoteY) break
      const cat = catMap[ev.category]
      const color = ev.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.circle(x + 1, noteLineY - 0.5, 0.5, 'F')
      const groups = groupConsecutiveDates(dates)
      const rangeStr = groups.map(g => formatRangeLabel(g)).join(', ')
      const lineText = `${rangeStr} | ${ev.label}`
      const wrappedLines = doc.splitTextToSize(lineText, w - 3.5)
      doc.setTextColor(60, 60, 60)
      doc.text(wrappedLines, x + 2.5, noteLineY, { maxWidth: w - 3.5 })
      noteLineY += wrappedLines.length * 1.5 + 0.6
    }
  }
}

// Pre-scan events to find max unique events in any single month (for dynamic panel height)
function computeMaxEventsPerMonth(events, academicYear) {
  return Math.max(...getAcademicMonths(academicYear).map(({ year, month }) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const seen = new Set()
    Object.entries(events).forEach(([dk, evs]) => {
      if (!dk.startsWith(monthKey)) return
      ;(evs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => seen.add(`${ev.category}::${ev.label}`))
    })
    return seen.size
  }), 0)
}

function drawBottomEventsPanel(doc, events, categories, y, pageW, margin, sidebarW, panelH, academicYear) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })
  const MONTHS = getAcademicMonths(academicYear)

  const panelY = y
  const panelW = pageW - margin * 2 - sidebarW - 2
  const eventsBottom = panelY + panelH - 2  // clip events to stay inside panel

  // Panel background
  doc.setFillColor(15, 45, 61)
  doc.roundedRect(margin, panelY, panelW, panelH, 2, 2, 'F')

  // Header
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(5)
  doc.setFont('helvetica', 'bold')
  doc.text('EVENTS BY MONTH', margin + 3, panelY + 4)

  // Month columns
  const colW = panelW / MONTHS.length
  const MONTH_ABBR = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']

  MONTHS.forEach(({ year, month }, mi) => {
    const colX = margin + mi * colW
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

    // Column header
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
    doc.setFont('helvetica', 'normal')
    Object.values(monthEvs).sort((a, b) => a.dates[0].localeCompare(b.dates[0])).forEach(({ ev, dates }) => {
      // Stop rendering if we'd overflow the panel
      if (evY > eventsBottom) return

      const cat = catMap[ev.category]
      const color = ev.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.circle(colX + 1.2, evY - 0.5, 0.7, 'F')
      const groups = groupConsecutiveDates([...dates].sort())
      const rangeStr = groups.map(g => formatRangeLabel(g)).join(', ')
      doc.setFontSize(3)
      const fullText = `${rangeStr} ${ev.label}`
      const labelLines = doc.splitTextToSize(fullText, colW - 3.5)
      doc.setTextColor(200, 220, 240)
      doc.text(labelLines, colX + 2.5, evY)
      evY += labelLines.length * 1.2 + 1.8
    })
  })
}

// Helper: draw a per-month inline notes strip at (x, y, w × h)
function drawNotesStrip(doc, events, catMap, x, y, w, h, year, month) {
  const days = getDaysInMonth(year, month)
  doc.setFillColor(248, 249, 251)
  doc.rect(x, y, w, h, 'F')
  doc.setDrawColor(210, 215, 220); doc.setLineWidth(0.15)
  doc.line(x, y, x + w, y)
  const notesEvents = {}
  days.forEach(date => {
    const dateKey = formatDateKey(date)
    ;(events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
      const key = `${ev.category}::${ev.label}`
      if (!notesEvents[key]) notesEvents[key] = { ev, dates: [] }
      notesEvents[key].dates.push(dateKey)
    })
  })
  let lineY = y + 2.5
  const maxY = y + h - 0.5
  doc.setFontSize(3.2); doc.setFont('helvetica', 'normal')
  for (const { ev, dates } of Object.values(notesEvents)) {
    if (lineY > maxY) break
    const cat = catMap[ev.category]
    const color = ev.color || cat?.color || '#999'
    const [r, g, b] = hexToRgbLocal(color)
    doc.setFillColor(r, g, b); doc.circle(x + 1, lineY - 0.5, 0.5, 'F')
    const groups = groupConsecutiveDates([...dates].sort())
    const rangeStr = groups.map(g => formatRangeLabel(g)).join(', ')
    const lineText = `${rangeStr} | ${ev.label}`
    const lines = doc.splitTextToSize(lineText, w - 3.5)
    doc.setTextColor(60, 60, 60)
    doc.text(lines, x + 2.5, lineY, { maxWidth: w - 3.5 })
    lineY += lines.length * 1.5 + 0.6
  }
}

export async function exportPDF(state, { preview = false, pdfStyle = 'classic', monthIndex = null } = {}) {
  const { events, categories, schoolInfo, settings } = state
  const theme = getTheme(settings.theme, settings.customPrimary, settings.customAccent)
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const hasMontserrat = await loadMontserrat(doc)
  const titleFont = hasMontserrat ? 'Montserrat' : 'helvetica'
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'
  const ctx = { preview, theme, doc, titleFont, shabbatLabel }

  // Route to the correct style renderer
  if (pdfStyle === 'minimal')          return exportMinimal(state, ctx)
  if (pdfStyle === 'portrait-monthly') return exportMonthlyPortrait(state, { ...ctx, monthIndex })
  if (pdfStyle === 'year-at-a-glance') return exportYearAtAGlance(state, ctx)
  if (pdfStyle === 'dark-elegant')     return exportDarkElegant(state, ctx)
  if (pdfStyle === 'bulletin-board')   return exportBulletinBoard(state, ctx)
  // default: classic
  const isCompact = settings.template === 'compact'
  const showBottomPanel = settings.eventsPanel === 'bottom'

  // Layout measurements
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / COL_COUNT) - 2
  const MONTH_ROWS = 3
  // Dynamic bottom panel height: grows to fit the busiest month (capped at 90mm)
  const maxEvPerMonth = showBottomPanel ? computeMaxEventsPerMonth(events, settings.academicYear) : 0
  const dynamicPanelH = showBottomPanel
    ? Math.min(Math.max(BOTTOM_PANEL_H, 11 + maxEvPerMonth * 4 + 4), 90)
    : 0
  // Dynamic inline notes strip height: grows per-event count, capped at 20mm
  // Each event line ≈ 2.1mm + 3mm header. Cells need at least 4mm each (24mm for 6 rows).
  const maxInlineEvents = !showBottomPanel ? computeMaxEventsPerMonth(events, settings.academicYear) : 0
  const globalNotesStripH = maxInlineEvents > 0
    ? Math.min(Math.max(12, maxInlineEvents * 2.2 + 3), 20)
    : 0
  const availH = showBottomPanel
    ? PAGE_H - (HEADER_H + 2) - MARGIN - dynamicPanelH - 4
    : PAGE_H - (HEADER_H + 2) - MARGIN - 2
  const MONTH_H = (availH / MONTH_ROWS - 3) * (isCompact ? 0.85 : 1)

  // ── Header ──────────────────────────────────────────
  // Left dark band (~60% width)
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, PAGE_W * 0.62, HEADER_H, 'F')
  // Right slightly lighter band (~40% width)
  doc.setFillColor(Math.min(255,pr+12), Math.min(255,pg+16), Math.min(255,pb+25))
  doc.rect(PAGE_W * 0.62, 0, PAGE_W * 0.38, HEADER_H, 'F')
  // Accent bar along the bottom of the header
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, HEADER_H - 1.5, PAGE_W, 1.5, 'F')

  // Logo — circular crop via canvas
  if (schoolInfo.logo) {
    try {
      const circularLogo = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(circularLogo, 'PNG', MARGIN, 2, 13, 13)
    } catch {}
  }

  // Gold left accent bar before logo
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, 0, 3, HEADER_H - 1.5, 'F')

  // School name / custom title — ACCENT color, prominent
  const displayTitle = settings.calendarTitle || schoolInfo.name || 'YAYOE Calendar'
  doc.setTextColor(ar, ag, ab)
  doc.setFontSize(12)
  doc.setFont(titleFont, 'bold')
  doc.text(displayTitle, MARGIN + 16, 9)
  // Secondary line: "Academic Year 2026–2027  •  5787" (Hebrew year optional)
  doc.setFontSize(7)
  doc.setFont(titleFont, 'normal')
  doc.setTextColor(255, 255, 255)
  const hebrewYear = settings.hebrewYear || ''
  const yearLine = settings.showHebrewYear !== false && hebrewYear
    ? `Academic Year  ${settings.academicYear || '2026–2027'}  •  ${hebrewYear}`
    : `Academic Year  ${settings.academicYear || '2026–2027'}`
  doc.text(yearLine, MARGIN + 16, 14)

  // ── Draft Watermark ──────────────────────────────────
  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50)
    doc.setFontSize(72)
    doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  // ── Calendar Grid ──────────────────────────────────
  const startY = HEADER_H + 2

  getAcademicMonths(settings.academicYear).forEach(({ year, month }, idx) => {
    const col = idx % COL_COUNT
    const row = Math.floor(idx / COL_COUNT)
    const x = MARGIN + col * (MONTH_W + 2)
    const y = startY + row * (MONTH_H + 3)
    drawMonth(doc, { year, month }, events, categories, settings, x, y, MONTH_W, MONTH_H, shabbatLabel, globalNotesStripH, theme)
  })

  // ── Bottom Events Panel ──────────────────────────────
  if (showBottomPanel) {
    const panelTop = startY + MONTH_ROWS * (MONTH_H + 3) + 2
    drawBottomEventsPanel(doc, events, categories, panelTop, PAGE_W, MARGIN, SIDEBAR_W, dynamicPanelH, settings.academicYear)
  }

  // ── Sidebar ──────────────────────────────────────────
  const sbX = PAGE_W - MARGIN - SIDEBAR_W
  const sbTop = HEADER_H + 2
  const sbH = PAGE_H - sbTop - MARGIN
  const sbCx = sbX + SIDEBAR_W / 2  // horizontal center of sidebar

  // White background + light border
  doc.setFillColor(255, 255, 255)
  doc.rect(sbX, sbTop, SIDEBAR_W, sbH, 'F')
  doc.setDrawColor(210, 215, 225)
  doc.setLineWidth(0.2)
  doc.rect(sbX, sbTop, SIDEBAR_W, sbH, 'S')

  // ── Title strip ──
  const titleStripH = 32
  doc.setFillColor(pr, pg, pb)
  doc.rect(sbX, sbTop, SIDEBAR_W, titleStripH, 'F')
  // Accent bar along bottom of strip
  doc.setFillColor(ar, ag, ab)
  doc.rect(sbX, sbTop + titleStripH - 2, SIDEBAR_W, 2, 'F')
  // "YAYOE" — large bold white, centered
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont(titleFont, 'bold')
  doc.text('YAYOE', sbCx, sbTop + 12, { align: 'center' })
  // Thin accent decorative rule below YAYOE
  doc.setDrawColor(ar, ag, ab)
  doc.setLineWidth(0.4)
  const stripRuleW = SIDEBAR_W * 0.6
  doc.line(sbCx - stripRuleW / 2, sbTop + 15, sbCx + stripRuleW / 2, sbTop + 15)
  // "Academic Year" label — accent, centered
  doc.setTextColor(ar, ag, ab)
  doc.setFontSize(6)
  doc.setFont(titleFont, 'normal')
  doc.text('Academic Year', sbCx, sbTop + 20, { align: 'center' })
  // Year value — white, bigger, centered
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont(titleFont, 'bold')
  doc.text(settings.academicYear || '2026–2027', sbCx, sbTop + 27, { align: 'center' })

  // ── Sidebar blocks (user-ordered) ──
  const ruleW = SIDEBAR_W * 0.78
  const blocks = (settings.sidebarBlocks || DEFAULT_SIDEBAR_BLOCKS).filter(b => b.visible !== false)
  let blockY = sbTop + titleStripH + 7
  const blockOpts = { sbX, sbCx, SIDEBAR_W, ruleW, pr, pg, pb, ar, ag, ab, textRgb: [50, 60, 80], schoolInfo, categories }
  blocks.forEach(b => { blockY = renderSidebarBlock(doc, b.id, blockY, blockOpts) })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}-${pdfStyle}.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// Shared helper: draw a single mini month grid onto an existing doc
// ────────────────────────────────────────────────────────────────────────────
function drawMiniMonth(doc, { year, month }, events, categories, settings, {
  x, y, w, h, pr, pg, pb, ar, ag, ab, titleFont, shabbatLabel, showEvents = true
}) {
  const days = getDaysInMonth(year, month)
  const startDow = getFirstDayOfWeek(year, month)
  const cellW = w / 7
  const HEADER_H = 8
  const DAY_H = 5
  const cellH = (h - HEADER_H - DAY_H) / 6

  // Month header bar
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(x, y, w, HEADER_H, 1, 1, 'F')
  doc.setFillColor(ar, ag, ab)
  doc.rect(x, y + HEADER_H - 1.5, w, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6); doc.setFont(titleFont, 'bold')
  const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
  const heLabel = getHebrewMonthLabel(year, month)
  doc.text(mName, x + 2, y + 5.5)
  if (heLabel) {
    doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
    doc.setTextColor(ar, ag, ab)
    doc.text(heLabel, x + w - 1.5, y + 5.5, { align: 'right' })
  }

  // Day-of-week header row
  const headY = y + HEADER_H + DAY_H - 1
  DAYS.forEach((d, i) => {
    const isSha = i === 6
    if (isSha) {
      doc.setFillColor(pr, pg, pb)
      doc.setGState(doc.GState({ opacity: 0.1 }))
      doc.rect(x + i * cellW, y + HEADER_H, cellW, DAY_H, 'F')
      doc.setGState(doc.GState({ opacity: 1.0 }))
    }
    doc.setTextColor(isSha ? pr : 120, isSha ? pg : 120, isSha ? pb : 120)
    doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
    doc.text(isSha ? shabbatLabel.slice(0, 3).toUpperCase() : d, x + i * cellW + cellW / 2, headY, { align: 'center' })
  })

  // Day cells
  days.forEach(date => {
    const dayNum = date.getDate()
    const dow = (startDow + dayNum - 1) % 7
    const weekRow = Math.floor((startDow + dayNum - 1) / 7)
    const cx = x + dow * cellW
    const cy = y + HEADER_H + DAY_H + weekRow * cellH
    const dateKey = formatDateKey(date)
    const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
    const isSha = dow === 6
    const hebrewHolidayMini = getHolidayMap(settings.academicYear)[dateKey]

    // Shabbat tint
    if (isSha) {
      doc.setFillColor(pr, pg, pb)
      doc.setGState(doc.GState({ opacity: 0.07 }))
      doc.rect(cx, cy, cellW, cellH, 'F')
      doc.setGState(doc.GState({ opacity: 1.0 }))
    }

    // Event fill
    if (showEvents && dayEvs.length > 0) {
      const cat = categories.find(c => c.id === dayEvs[0].category)
      const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#999')
      doc.setFillColor(er, eg, eb)
      doc.roundedRect(cx + 0.2, cy + 0.2, cellW - 0.4, cellH - 0.4, 0.4, 0.4, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 1, cy + 3.2)
      // Event label (truncated to cell width)
      if (cellH >= 5) {
        doc.setFontSize(2.8); doc.setFont('helvetica', 'normal')
        const label = dayEvs[0].label || ''
        doc.text(label.length > 12 ? label.slice(0, 11) + '…' : label, cx + 1, cy + 5.8, { maxWidth: cellW - 1.5 })
      }
    } else {
      // Normal day number
      doc.setTextColor(isSha ? pr : 50, isSha ? pg : 50, isSha ? pb : 50)
      doc.setFontSize(3.8); doc.setFont('helvetica', isSha ? 'bold' : 'normal')
      doc.text(String(dayNum), cx + 1, cy + 3.2)
    }

    // Cell border
    doc.setDrawColor(210, 215, 220); doc.setLineWidth(0.15)
    doc.rect(cx, cy, cellW, cellH, 'S')

    // Hebrew holiday badge
    if (hebrewHolidayMini && settings.hebrewHolidayToggles?.[hebrewHolidayMini.group] !== false) {
      const customIcons = settings.hebrewHolidayIcons || {}
      const icon = customIcons[hebrewHolidayMini.group] || hebrewHolidayMini.icon
      doc.setFontSize(2.5); doc.setFont('helvetica', 'normal')
      doc.setTextColor(160, 100, 20)
      doc.text(`${icon}`, cx + cellW - 2.5, cy + cellH - 0.6, { align: 'right', maxWidth: cellW - 1 })
    }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 2: CLEAN MINIMAL — no sidebar, white bg, thin grid
// ────────────────────────────────────────────────────────────────────────────
async function exportMinimal(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 8
  const HEADER_H = 14
  const LEG_H = 9
  const showBottomPanel = settings.eventsPanel === 'bottom'
  const maxEvMin = showBottomPanel ? 0 : computeMaxEventsPerMonth(events, settings.academicYear)
  const NOTES_H = showBottomPanel ? 0 : Math.min(Math.max(8, maxEvMin * 2.2 + 2), 22)
  const BOTTOM_H = showBottomPanel ? 26 : 0
  const GRID_W = PAGE_W - MARGIN * 2
  const MONTH_W = (GRID_W / 4) - 2.5
  const MONTH_H = (PAGE_H - HEADER_H - 3 - MARGIN - LEG_H - BOTTOM_H - (showBottomPanel ? 2 : 0)) / 3 - NOTES_H - 3
  const catMap = {}; categories.forEach(c => { catMap[c.id] = c })

  // Pre-compute circular logo
  let circLogoMin = null
  if (schoolInfo.logo) { try { circLogoMin = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  // White page header with colored rule
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setDrawColor(pr, pg, pb); doc.setLineWidth(2)
  doc.line(0, HEADER_H, PAGE_W, HEADER_H)
  doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 2, PAGE_W, 2, 'F')
  if (circLogoMin) doc.addImage(circLogoMin, 'PNG', MARGIN, 1, 11, 11)
  doc.setTextColor(pr, pg, pb)
  doc.setFontSize(11); doc.setFont(titleFont, 'bold')
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', circLogoMin ? MARGIN + 13 : MARGIN, 9)
  doc.setFontSize(7); doc.setFont(titleFont, 'normal'); doc.setTextColor(130, 130, 130)
  doc.text(settings.academicYear || '2026-2027', PAGE_W - MARGIN, 9, { align: 'right' })

  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 3
  const MONTHS_MIN = getAcademicMonths(settings.academicYear)
  const rowStep = MONTH_H + (showBottomPanel ? 0 : NOTES_H) + 3
  MONTHS_MIN.forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + col * (MONTH_W + 3)
    const y = startY + row * rowStep
    drawMiniMonth(doc, { year, month }, events, categories, settings, {
      x, y, w: MONTH_W, h: MONTH_H, pr, pg, pb, ar, ag, ab, titleFont, shabbatLabel
    })
    if (!showBottomPanel) {
      drawNotesStrip(doc, events, catMap, x, y + MONTH_H, MONTH_W, NOTES_H, year, month)
    }
  })

  // ── Bottom events panel ───────────────────────────────────────────────────
  if (showBottomPanel) {
    const panelY = startY + 3 * rowStep
    drawBottomEventsPanel(doc, events, categories, panelY, PAGE_W, MARGIN, 0, BOTTOM_H, settings.academicYear)
  }

  // Legend strip at bottom
  const legY = PAGE_H - 7
  doc.setFillColor(248, 249, 252); doc.rect(0, legY - 2, PAGE_W, 10, 'F')
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(0, legY - 2, PAGE_W, legY - 2)
  let legX = MARGIN
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 8).forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb); doc.circle(legX + 1.5, legY + 1, 1.5, 'F')
    doc.setTextColor(60, 60, 60); doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
    doc.text(cat.name, legX + 4.5, legY + 2)
    legX += doc.getTextWidth(cat.name) + 11
  })

  if (preview) return doc.output('datauristring')
  const fname = `${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-Minimal.pdf`
  doc.save(fname)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 3: MONTHLY PORTRAIT — one month per page, portrait A4
// monthIndex: 0–9, which academic month to show (null = all)
// ────────────────────────────────────────────────────────────────────────────
async function exportMonthlyPortrait(state, { preview, theme, doc: _doc, titleFont, shabbatLabel, monthIndex = null }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 12
  const GRID_W = PAGE_W - MARGIN * 2
  const cellW = GRID_W / 7
  const HEADER_H = 26, DAY_H = 10
  const GRID_H = PAGE_H - HEADER_H - DAY_H - MARGIN * 2 - 16
  const cellH = GRID_H / 6

  // Pre-compute circular logo (once, reused on each page)
  let circLogoPort = null
  if (schoolInfo.logo) { try { circLogoPort = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  const MONTHS_PORT = getAcademicMonths(settings.academicYear)
  const monthsToRender = monthIndex !== null
    ? [MONTHS_PORT[monthIndex]].filter(Boolean)
    : MONTHS_PORT

  monthsToRender.forEach(({ year, month }, i) => {
    if (i > 0) doc.addPage()
    if (settings.draftWatermark) {
      doc.setTextColor(200, 50, 50); doc.setFontSize(80); doc.setFont('helvetica', 'bold')
      doc.setGState(doc.GState({ opacity: 0.15 }))
      doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 45 })
      doc.setGState(doc.GState({ opacity: 1.0 }))
    }
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const heLabel = getHebrewMonthLabel(year, month)

    // Header
    doc.setFillColor(pr, pg, pb); doc.rect(0, 0, PAGE_W, HEADER_H, 'F')
    doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 2.5, PAGE_W, 2.5, 'F')
    // Logo — right side of header so it doesn't collide with month name
    if (circLogoPort) doc.addImage(circLogoPort, 'PNG', PAGE_W - MARGIN - 14, 3, 14, 14)
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont(titleFont, 'bold')
    doc.text(mName, MARGIN, 14)
    if (heLabel) { doc.setFontSize(9); doc.setTextColor(ar, ag, ab); doc.text(heLabel, circLogoPort ? PAGE_W - MARGIN - 17 : PAGE_W - MARGIN, 14, { align: 'right' }) }
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255, 0.7)
    const portTitle = settings.calendarTitle || schoolInfo.name || ''
    const portHebrew = settings.showHebrewYear !== false && settings.hebrewYear ? `  •  ${settings.hebrewYear}` : ''
    doc.text(`${portTitle}  ·  ${settings.academicYear || ''}${portHebrew}`, MARGIN, 21)

    // Day headers
    DAYS.forEach((d, i2) => {
      const isSha = i2 === 6
      if (isSha) { doc.setFillColor(pr, pg, pb); doc.setGState(doc.GState({ opacity: 0.08 })); doc.rect(MARGIN + i2 * cellW, HEADER_H, cellW, DAY_H, 'F'); doc.setGState(doc.GState({ opacity: 1.0 })) }
      doc.setTextColor(isSha ? pr : 90, isSha ? pg : 90, isSha ? pb : 90)
      doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text(isSha ? shabbatLabel.slice(0, 3).toUpperCase() : d, MARGIN + i2 * cellW + cellW / 2, HEADER_H + 7, { align: 'center' })
    })

    // Day cells
    const days = getDaysInMonth(year, month)
    const startDow = getFirstDayOfWeek(year, month)
    const gridTop = HEADER_H + DAY_H + 2

    days.forEach(date => {
      const dayNum = date.getDate()
      const dow = (startDow + dayNum - 1) % 7
      const weekRow = Math.floor((startDow + dayNum - 1) / 7)
      const cx = MARGIN + dow * cellW
      const cy = gridTop + weekRow * cellH
      const dateKey = formatDateKey(date)
      const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
      const isSha = dow === 6

      // Shabbat bg
      if (isSha) { doc.setFillColor(pr, pg, pb); doc.setGState(doc.GState({ opacity: 0.06 })); doc.rect(cx, cy, cellW, cellH, 'F'); doc.setGState(doc.GState({ opacity: 1.0 })) }

      // Cell border
      doc.setDrawColor(215, 220, 225); doc.setLineWidth(0.2); doc.rect(cx, cy, cellW, cellH, 'S')

      // Day number
      doc.setTextColor(isSha ? pr : 35, isSha ? pg : 35, isSha ? pb : 35)
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 3, cy + 9)

      // Events as colored pills
      dayEvs.slice(0, 3).forEach((ev, ei) => {
        const cat = categories.find(c => c.id === ev.category)
        const [er, eg, eb] = hexToRgbLocal(ev.color || cat?.color || '#999')
        doc.setFillColor(er, eg, eb)
        doc.roundedRect(cx + 1.5, cy + 12 + ei * 8, cellW - 3, 6, 0.8, 0.8, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
        doc.text(ev.label, cx + 3, cy + 16.5 + ei * 8, { maxWidth: cellW - 5 })
      })
    })

    // Legend at bottom
    const legY = PAGE_H - MARGIN - 10
    doc.setFillColor(248, 249, 252); doc.roundedRect(MARGIN, legY, GRID_W, 10, 1, 1, 'F')
    doc.setDrawColor(pr, pg, pb); doc.setLineWidth(0.5); doc.line(MARGIN, legY, MARGIN + GRID_W, legY)
    let lx = MARGIN + 4
    categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 7).forEach(cat => {
      const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
      doc.setFillColor(cr, cg, cb); doc.roundedRect(lx, legY + 3, 5, 4, 0.5, 0.5, 'F')
      doc.setTextColor(55, 55, 55); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal')
      doc.text(cat.name, lx + 7, legY + 6.5)
      lx += doc.getTextWidth(cat.name) + 16
    })
  })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-Monthly.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 4: YEAR AT A GLANCE — all months tiny on one landscape page
// ────────────────────────────────────────────────────────────────────────────
async function exportYearAtAGlance(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 5
  const COLS = 4, ROWS = 3  // 4×3 = 12 slots for 11 months, June no longer cut off
  const MONTH_W = (PAGE_W - MARGIN * 2 - (COLS - 1) * 2) / COLS
  const HEADER_H = 12
  const MONTH_H = (PAGE_H - HEADER_H - MARGIN * 2 - (ROWS - 1) * 2) / ROWS

  // Pre-compute circular logo
  let circLogoGlance = null
  if (schoolInfo.logo) { try { circLogoGlance = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  // Page header
  doc.setFillColor(pr, pg, pb); doc.rect(0, 0, PAGE_W, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 1.5, PAGE_W, 1.5, 'F')
  if (circLogoGlance) doc.addImage(circLogoGlance, 'PNG', MARGIN, 1, 9, 9)
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont(titleFont, 'bold')
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', circLogoGlance ? MARGIN + 11 : MARGIN + 2, 8)
  doc.setTextColor(ar, ag, ab); doc.setFontSize(7)
  doc.text(`Year at a Glance  ·  ${settings.academicYear || '2026-2027'}`, PAGE_W - MARGIN - 2, 8, { align: 'right' })

  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 2
  getAcademicMonths(settings.academicYear).forEach(({ year, month }, idx) => {
    const col = idx % COLS; const row = Math.floor(idx / COLS)
    const mx = MARGIN + col * (MONTH_W + 2)
    const my = startY + row * (MONTH_H + 2)
    drawMiniMonth(doc, { year, month }, events, categories, settings, {
      x: mx, y: my, w: MONTH_W, h: MONTH_H, pr, pg, pb, ar, ag, ab, titleFont, shabbatLabel
    })
  })

  // Legend
  const legY = PAGE_H - 5.5
  let lx = MARGIN
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 10).forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb); doc.circle(lx + 1.2, legY, 1.2, 'F')
    doc.setTextColor(60, 60, 60); doc.setFontSize(3.8); doc.setFont('helvetica', 'normal')
    doc.text(cat.name, lx + 3.5, legY + 1.2)
    lx += doc.getTextWidth(cat.name) + 9
  })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-YearAtAGlance.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 5: DARK ELEGANT — dark navy background, accent headers
// ────────────────────────────────────────────────────────────────────────────
async function exportDarkElegant(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 8, SIDEBAR_W = 50
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / 4) - 2
  const HEADER_H = 18
  const showBottomPanel = settings.eventsPanel === 'bottom'
  const maxEvDE = showBottomPanel ? 0 : computeMaxEventsPerMonth(events, settings.academicYear)
  const NOTES_H = showBottomPanel ? 0 : Math.min(Math.max(8, maxEvDE * 2.2 + 2), 22)
  const BOTTOM_H = showBottomPanel ? 26 : 0
  const catMapDE = {}; categories.forEach(c => { catMapDE[c.id] = c })
  const MONTH_H = (PAGE_H - HEADER_H - MARGIN - 6 - BOTTOM_H) / 3 - (showBottomPanel ? 0 : NOTES_H)
  const BG = [15, 20, 38], CARD = [24, 32, 58], TEXC = [215, 225, 245]

  // Pre-compute circular logo
  let circLogoDark = null
  if (schoolInfo.logo) { try { circLogoDark = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  // Dark background fill
  doc.setFillColor(...BG); doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  // Accent left bar
  doc.setFillColor(ar, ag, ab); doc.rect(0, 0, 4, PAGE_H, 'F')
  // Header card
  doc.setFillColor(...CARD); doc.rect(4, 0, PAGE_W - 4, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(4, HEADER_H - 1.5, PAGE_W - 4, 1.5, 'F')
  if (circLogoDark) doc.addImage(circLogoDark, 'PNG', MARGIN + 2, 2, 12, 12)
  doc.setTextColor(ar, ag, ab); doc.setFontSize(11); doc.setFont(titleFont, 'bold')
  const darkNameX = circLogoDark ? MARGIN + 16 : MARGIN + 4
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', darkNameX, 10)
  doc.setTextColor(...TEXC); doc.setFontSize(7); doc.setFont(titleFont, 'normal')
  doc.text(`Academic Year  ${settings.academicYear || '2026-2027'}`, PAGE_W - MARGIN - 4, 15, { align: 'right' })

  if (settings.draftWatermark) {
    doc.setTextColor(220, 80, 80); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.12 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 2
  const deRowStep = MONTH_H + (showBottomPanel ? 0 : NOTES_H) + 3
  getAcademicMonths(settings.academicYear).forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + 4 + col * (MONTH_W + 2.5)
    const y = startY + row * deRowStep

    // Month card
    doc.setFillColor(...CARD); doc.roundedRect(x, y, MONTH_W, MONTH_H, 1.5, 1.5, 'F')

    // Month header (accent band)
    doc.setFillColor(ar, ag, ab); doc.roundedRect(x, y, MONTH_W, 8, 1.5, 1.5, 'F')
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    doc.setTextColor(...BG); doc.setFontSize(6.5); doc.setFont(titleFont, 'bold')
    doc.text(`${mName} ${year}`, x + 2, y + 5.5)

    // Day header row
    const cellW = MONTH_W / 7; const headY = y + 11
    DAYS.forEach((d, i) => {
      const isSha = i === 6
      doc.setTextColor(isSha ? ar : 140, isSha ? ag : 155, isSha ? ab : 185)
      doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
      doc.text(isSha ? shabbatLabel.slice(0, 3).toUpperCase() : d, x + i * cellW + cellW / 2, headY, { align: 'center' })
    })

    // Day cells
    const days = getDaysInMonth(year, month)
    const startDow = getFirstDayOfWeek(year, month)
    const cellH = (MONTH_H - 13) / 6

    days.forEach(date => {
      const dayNum = date.getDate()
      const dow = (startDow + dayNum - 1) % 7
      const weekRow = Math.floor((startDow + dayNum - 1) / 7)
      const cx = x + dow * cellW
      const cy = y + 12 + weekRow * cellH
      const dateKey = formatDateKey(date)
      const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')

      // Event filled cell
      if (dayEvs.length > 0) {
        const cat = categories.find(c => c.id === dayEvs[0].category)
        const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#888')
        doc.setFillColor(er, eg, eb); doc.roundedRect(cx + 0.3, cy + 0.3, cellW - 0.6, cellH - 0.6, 0.5, 0.5, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3.8); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 1, cy + 3.5)
        if (cellH >= 7) {
          doc.setFontSize(2.8); doc.setFont('helvetica', 'normal')
          const lbl = dayEvs[0].label || ''
          doc.text(lbl.length > 9 ? lbl.slice(0, 8) + '…' : lbl, cx + 1, cy + 5.8, { maxWidth: cellW - 1.5 })
        }
      } else {
        // Shabbat shade
        if (dow === 6) { doc.setFillColor(ar, ag, ab); doc.setGState(doc.GState({ opacity: 0.1 })); doc.rect(cx, cy, cellW, cellH, 'F'); doc.setGState(doc.GState({ opacity: 1.0 })) }
        if (dow === 6) doc.setTextColor(ar, ag, ab)
        else doc.setTextColor(TEXC[0], TEXC[1], TEXC[2])
        doc.setFontSize(3.8); doc.setFont('helvetica', 'normal')
        doc.text(String(dayNum), cx + 1, cy + 3.5)
      }
    })
    if (!showBottomPanel) {
      drawNotesStrip(doc, events, catMapDE, x, y + MONTH_H, MONTH_W, NOTES_H, year, month)
    }
  })

  if (showBottomPanel) {
    const panelY = startY + 3 * deRowStep
    drawBottomEventsPanel(doc, events, categories, panelY, PAGE_W, MARGIN, SIDEBAR_W, BOTTOM_H, settings.academicYear)
  }

  // Dark sidebar — blocks rendered using shared helper with dark theme colors
  const sbX = PAGE_W - MARGIN - SIDEBAR_W
  doc.setFillColor(...CARD); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, PAGE_H - HEADER_H - MARGIN - 2, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, 8, 'F')
  doc.setTextColor(...BG); doc.setFontSize(7); doc.setFont(titleFont, 'bold')
  doc.text('', sbX + SIDEBAR_W / 2, HEADER_H + 8, { align: 'center' }) // spacer
  const deSbCx = sbX + SIDEBAR_W / 2
  const deRuleW = SIDEBAR_W * 0.78
  const deBlocks = (settings.sidebarBlocks || DEFAULT_SIDEBAR_BLOCKS).filter(b => b.visible !== false)
  let deBlockY = HEADER_H + 14
  const [deAr, deAg, deAb] = [ar, ag, ab]
  const deBlockOpts = {
    sbX, sbCx: deSbCx, SIDEBAR_W, ruleW: deRuleW,
    pr: ar, pg: ag, pb: ab,   // use accent as heading color on dark bg
    ar: deAr, ag: deAg, ab: deAb,
    textRgb: TEXC, linkRgb: [ar, ag, ab],
    schoolInfo, categories,
  }
  deBlocks.forEach(b => { deBlockY = renderSidebarBlock(doc, b.id, deBlockY, deBlockOpts) })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-DarkElegant.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 6: BULLETIN BOARD — bold, vibrant per-month colors
// ────────────────────────────────────────────────────────────────────────────
async function exportBulletinBoard(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 6, SIDEBAR_W = 50
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / 4) - 2
  const HEADER_H = 16
  const showBottomPanelBB = settings.eventsPanel === 'bottom'
  const maxEvBB = showBottomPanelBB ? 0 : computeMaxEventsPerMonth(events, settings.academicYear)
  const NOTES_H_BB = showBottomPanelBB ? 0 : Math.min(Math.max(8, maxEvBB * 2.2 + 2), 22)
  const BOTTOM_H_BB = showBottomPanelBB ? 26 : 0
  const catMapBB = {}; categories.forEach(c => { catMapBB[c.id] = c })
  const MONTH_H = (PAGE_H - HEADER_H - MARGIN - 6 - BOTTOM_H_BB) / 3 - (showBottomPanelBB ? 0 : NOTES_H_BB)
  const PALETTE = ['#E63946','#2A9D8F','#E9800A','#264653','#6A4C93','#F4A261','#43AA8B','#577590','#E07A5F','#3D405B']

  // Pre-compute circular logo
  let circLogoBB = null
  if (schoolInfo.logo) { try { circLogoBB = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  // Theme-colored header bar (month bodies still use the colorful PALETTE)
  doc.setFillColor(pr, pg, pb); doc.rect(0, 0, PAGE_W, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 1.5, PAGE_W, 1.5, 'F')
  if (circLogoBB) doc.addImage(circLogoBB, 'PNG', MARGIN, 1.5, 11, 11)
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont(titleFont, 'bold')
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', circLogoBB ? MARGIN + 13 : MARGIN + 2, 9)
  doc.setTextColor(ar, ag, ab); doc.setFontSize(8)
  doc.text(settings.academicYear || '2026-2027', PAGE_W - MARGIN - 4, 9, { align: 'right' })

  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 2
  const bbRowStep = MONTH_H + (showBottomPanelBB ? 0 : NOTES_H_BB) + 3
  getAcademicMonths(settings.academicYear).forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + col * (MONTH_W + 2)
    const y = startY + row * bbRowStep
    const hdrColor = PALETTE[idx % PALETTE.length]
    const [hcr, hcg, hcb] = hexToRgbLocal(hdrColor)

    // Month header
    doc.setFillColor(hcr, hcg, hcb); doc.roundedRect(x, y, MONTH_W, 9, 1.5, 1.5, 'F')
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont(titleFont, 'bold')
    doc.text(`${mName} ${year}`, x + MONTH_W / 2, y + 6.2, { align: 'center' })

    // Day-of-week headers
    const cellW = MONTH_W / 7; const headY = y + 12.5
    DAYS.forEach((d, i) => {
      const isSha = i === 6
      if (isSha) { doc.setFillColor(hcr, hcg, hcb); doc.setGState(doc.GState({ opacity: 0.15 })); doc.rect(x + i * cellW, headY - 3, cellW, 5, 'F'); doc.setGState(doc.GState({ opacity: 1.0 })) }
      doc.setTextColor(isSha ? hcr : 80, isSha ? hcg : 80, isSha ? hcb : 80)
      doc.setFontSize(4); doc.setFont('helvetica', 'bold')
      doc.text(isSha ? shabbatLabel.slice(0, 3).toUpperCase() : d, x + i * cellW + cellW / 2, headY, { align: 'center' })
    })
    doc.setDrawColor(hcr, hcg, hcb); doc.setLineWidth(0.6); doc.line(x, headY + 1.5, x + MONTH_W, headY + 1.5)

    // Day cells
    const days = getDaysInMonth(year, month)
    const startDow = getFirstDayOfWeek(year, month)
    const cellH = (MONTH_H - 15) / 6

    days.forEach(date => {
      const dayNum = date.getDate()
      const dow = (startDow + dayNum - 1) % 7
      const weekRow = Math.floor((startDow + dayNum - 1) / 7)
      const cx = x + dow * cellW
      const cy = y + 14.5 + weekRow * cellH
      const dateKey = formatDateKey(date)
      const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')

      if (dayEvs.length > 0) {
        const cat = categories.find(c => c.id === dayEvs[0].category)
        const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#999')
        doc.setFillColor(er, eg, eb); doc.roundedRect(cx + 0.3, cy + 0.3, cellW - 0.6, cellH - 0.6, 0.5, 0.5, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3.8); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 1, cy + 3.5)
        if (cellH >= 7) {
          doc.setFontSize(2.8); doc.setFont('helvetica', 'normal')
          const lbl = dayEvs[0].label || ''
          doc.text(lbl.length > 9 ? lbl.slice(0, 8) + '…' : lbl, cx + 1, cy + 5.8, { maxWidth: cellW - 1.5 })
        }
      } else if (dow === 6) {
        doc.setFillColor(hcr, hcg, hcb); doc.setGState(doc.GState({ opacity: 0.1 })); doc.rect(cx, cy, cellW, cellH, 'F'); doc.setGState(doc.GState({ opacity: 1.0 }))
        doc.setTextColor(hcr, hcg, hcb)
        doc.setFontSize(3.8); doc.setFont('helvetica', 'normal'); doc.text(String(dayNum), cx + 1, cy + 3.5)
      } else {
        doc.setTextColor(50, 50, 60)
        doc.setFontSize(3.8); doc.setFont('helvetica', 'normal'); doc.text(String(dayNum), cx + 1, cy + 3.5)
      }
    })
    if (!showBottomPanelBB) {
      drawNotesStrip(doc, events, catMapBB, x, y + MONTH_H, MONTH_W, NOTES_H_BB, year, month)
    }
  })

  if (showBottomPanelBB) {
    const panelY = startY + 3 * bbRowStep
    drawBottomEventsPanel(doc, events, categories, panelY, PAGE_W, MARGIN, SIDEBAR_W, BOTTOM_H_BB, settings.academicYear)
  }

  // Sidebar — blocks rendered using shared helper
  const sbX = PAGE_W - MARGIN - SIDEBAR_W
  doc.setFillColor(252, 252, 255); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, PAGE_H - HEADER_H - MARGIN - 2, 'F')
  doc.setFillColor(pr, pg, pb); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, 8, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont(titleFont, 'bold')
  doc.text('', sbX + SIDEBAR_W / 2, HEADER_H + 8, { align: 'center' }) // spacer
  const bbSbCx = sbX + SIDEBAR_W / 2
  const bbRuleW = SIDEBAR_W * 0.78
  const bbBlocks = (settings.sidebarBlocks || DEFAULT_SIDEBAR_BLOCKS).filter(b => b.visible !== false)
  let bbBlockY = HEADER_H + 14
  const bbBlockOpts = {
    sbX, sbCx: bbSbCx, SIDEBAR_W, ruleW: bbRuleW,
    pr, pg, pb, ar, ag, ab,
    textRgb: [40, 40, 55], linkRgb: [pr, pg, pb],
    schoolInfo, categories,
  }
  bbBlocks.forEach(b => { bbBlockY = renderSidebarBlock(doc, b.id, bbBlockY, bbBlockOpts) })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-BulletinBoard.pdf`)
}


