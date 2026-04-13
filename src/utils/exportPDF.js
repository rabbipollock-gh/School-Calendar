import { jsPDF } from 'jspdf'
import { loadMontserrat } from './pdfFonts.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel } from './dateUtils.js'

import { getAcademicMonths } from './academicMonths.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'
import { getRoshChodeshMap, getHolidayMap, getHebrewDayNumber } from '../data/hebrewCalendar.js'
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

// Draws a thin double-rule border with corner marks. Used by Parchment Scroll template.
function drawPageBorder(doc, pageW, pageH, goldHex = '#C8A96E') {
  const [r, g, b] = hexToRgbLocal(goldHex)
  doc.setDrawColor(r, g, b)
  // Outer rule
  doc.setLineWidth(0.6)
  doc.rect(5, 5, pageW - 10, pageH - 10)
  // Inner rule
  doc.setLineWidth(0.25)
  doc.rect(7, 7, pageW - 14, pageH - 14)
  // Corner marks (small diagonal lines at each corner)
  const m = 5, off = 3
  doc.setLineWidth(0.4)
  doc.line(m, m, m + off, m + off)
  doc.line(pageW - m, m, pageW - m - off, m + off)
  doc.line(m, pageH - m, m + off, pageH - m - off)
  doc.line(pageW - m, pageH - m, pageW - m - off, pageH - m - off)
}

// Draws a row of small 45°-rotated diamond shapes as a decorative band. Used by Elegant Feminine template.
function drawDecorativeDiamondBand(doc, bandY, pageW, primaryRgb, accentRgb, margin = 10) {
  const [pr, pg, pb] = primaryRgb
  const [ar, ag, ab] = accentRgb
  const size = 1.5    // half-width of each diamond
  const spacing = 5   // center-to-center distance
  const startX = margin + size
  const endX = pageW - margin - size
  let x = startX
  let toggle = 0
  while (x <= endX) {
    if (toggle % 3 === 1) {
      doc.setFillColor(ar, ag, ab)
    } else {
      doc.setFillColor(pr, pg, pb)
    }
    // Draw diamond as a rotated square using 4 lines
    doc.lines(
      [[size, size], [size, -size], [-size, -size], [-size, size]],
      x - size, bandY,
      [1, 1], 'F', true
    )
    x += spacing
    toggle++
  }
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
  if (pdfStyle === 'minimal')           return exportMinimal(state, ctx)
  if (pdfStyle === 'portrait-monthly')  return exportMonthlyPortrait(state, { ...ctx, monthIndex })
  if (pdfStyle === 'year-at-a-glance')  return exportYearAtAGlance(state, ctx)
  if (pdfStyle === 'dark-elegant')      return exportDarkElegant(state, ctx)
  if (pdfStyle === 'bulletin-board')    return exportBulletinBoard(state, ctx)
  if (pdfStyle === 'parchment-scroll')  return exportParchmentScroll(state, { preview, monthIndex })
  if (pdfStyle === 'dual-heritage')     return exportDualHeritage(state, { preview, theme, doc, titleFont, shabbatLabel })
  if (pdfStyle === 'regal-triptych')    return exportRegalTriptych(state, { preview, theme, doc, titleFont, shabbatLabel })
  if (pdfStyle === 'photo-showcase')    return exportPhotoShowcase(state, { preview, monthIndex })
  if (pdfStyle === 'hebrew-date-focus') return exportHebrewDateFocus(state, { preview, theme, doc, titleFont, shabbatLabel })
  if (pdfStyle === 'elegant-feminine')  return exportElegantFeminine(state, { preview, monthIndex })
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

// ─────────────────────────────────────────────────────────────────────────────
// Template 7 — Parchment Scroll
// Portrait A4, 11 pages (one per month), ketubah/yeshiva document feel.
// Parchment background, sepia text, double-rule border, warm gold accents.
// ─────────────────────────────────────────────────────────────────────────────
async function exportParchmentScroll(state, { preview, monthIndex = null }) {
  const { events, categories, schoolInfo, settings } = state
  const PARCH_BG  = '#F5EFD8'
  const SEPIA     = '#3B2206'
  const CRIMSON   = '#8B1A1A'
  const GOLD      = '#C8A96E'
  const [bgR, bgG, bgB]  = hexToRgbLocal(PARCH_BG)
  const [sR, sG, sB]     = hexToRgbLocal(SEPIA)
  const [crR, crG, crB]  = hexToRgbLocal(CRIMSON)
  const [gR, gG, gB]     = hexToRgbLocal(GOLD)

  const PW = 210, PH = 297  // A4 portrait
  const MARGIN = 12
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await loadMontserrat(doc)

  const months = getAcademicMonths(settings.academicYear)
  const roshChodeshMap = getRoshChodeshMap(settings.academicYear)
  const holidayMap     = getHolidayMap    (settings.academicYear)
  const shabbatLabel   = settings.shabbatLabel || 'Shabbat'

  const monthList = monthIndex != null ? [months[monthIndex]] : months

  for (let pageIdx = 0; pageIdx < monthList.length; pageIdx++) {
    const { year, month } = monthList[pageIdx]
    if (pageIdx > 0) doc.addPage()

    // Parchment background
    doc.setFillColor(bgR, bgG, bgB)
    doc.rect(0, 0, PW, PH, 'F')

    // Double-rule border in gold
    drawPageBorder(doc, PW, PH, GOLD)

    // School name at top
    const schoolName = schoolInfo.name || 'School Calendar'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(crR, crG, crB)
    doc.text(schoolName.toUpperCase(), PW / 2, 18, { align: 'center' })

    // Month title
    const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hebrewLabel = getHebrewMonthLabel(year, month)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(sR, sG, sB)
    doc.text(`${monthName} ${year}`, PW / 2, 28, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(gR, gG, gB)
    doc.text(hebrewLabel, PW / 2, 34, { align: 'center' })

    // Decorative rule below title
    doc.setDrawColor(gR, gG, gB)
    doc.setLineWidth(0.5)
    doc.line(MARGIN + 5, 36.5, PW - MARGIN - 5, 36.5)
    doc.setLineWidth(0.2)
    doc.line(MARGIN + 5, 38, PW - MARGIN - 5, 38)

    // Logo
    if (schoolInfo.logo) {
      try {
        doc.addImage(schoolInfo.logo, 'PNG', MARGIN + 2, 13, 12, 12)
      } catch {}
    }

    // Grid
    const gridTop = 41
    const gridH = PH - gridTop - MARGIN - 4
    const cellW = (PW - MARGIN * 2) / 7
    const firstDay = getFirstDayOfWeek(year, month)
    const daysInMonth = getDaysInMonth(year, month)
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    const rows = totalCells / 7
    const cellH = gridH / rows

    // Day headers
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', shabbatLabel.slice(0, 3)]
    DAY_LABELS.forEach((d, i) => {
      const cx = MARGIN + i * cellW + cellW / 2
      if (i === 6) {
        doc.setFillColor(sR, sG, sB)
        doc.rect(MARGIN + i * cellW, gridTop, cellW, 5, 'F')
        doc.setTextColor(bgR, bgG, bgB)
      } else {
        doc.setTextColor(crR, crG, crB)
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.text(d, cx, gridTop + 3.5, { align: 'center' })
    })

    // Cells
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDay + 1
      const col = i % 7
      const row = Math.floor(i / 7)
      const cx = MARGIN + col * cellW
      const cy = gridTop + 5 + row * cellH
      const dateKey = dayNum >= 1 && dayNum <= daysInMonth ? formatDateKey(year, month, dayNum) : null

      // Shabbat column tint
      if (col === 6 && dateKey) {
        doc.setFillColor(sR, sG, sB, 0.08)
        doc.setFillColor(Math.min(255, sR + 175), Math.min(255, sG + 145), Math.min(255, sB + 115))
        doc.rect(cx, cy, cellW, cellH, 'F')
      }

      // Cell border — gold
      doc.setDrawColor(gR, gG, gB)
      doc.setLineWidth(0.2)
      doc.rect(cx, cy, cellW, cellH)

      if (!dateKey) continue

      // Day number
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(sR, sG, sB)
      doc.text(String(dayNum), cx + 1.5, cy + 4.5)

      // Rosh Chodesh
      if (roshChodeshMap[dateKey]) {
        doc.setFontSize(3.8)
        doc.setTextColor(crR, crG, crB)
        doc.text('ר"ח', cx + cellW - 1.5, cy + 4, { align: 'right' })
      }

      // Holiday badge
      const holiday = holidayMap[dateKey]
      if (holiday) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(3.8)
        doc.setTextColor(crR, crG, crB)
        const label = settings.shabbatLabel === 'Shabbos' ? holiday.ashkenaz : holiday.sephardi
        doc.text(label, cx + cellW / 2, cy + 8.5, { align: 'center', maxWidth: cellW - 2 })
      }

      // Events
      const dayEvents = (events[dateKey] || []).slice(0, 3)
      dayEvents.forEach((ev, ei) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 1, cy + 11 + ei * 4.5, cellW - 2, 3.5, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3.2)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1.5, cy + 13.5 + ei * 4.5, { maxWidth: cellW - 3 })
      })
    }

    // Footer
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4)
    doc.setTextColor(gR, gG, gB)
    if (schoolInfo.address) doc.text(schoolInfo.address, PW / 2, PH - 9, { align: 'center' })
    const contact = [schoolInfo.phone, schoolInfo.email].filter(Boolean).join('  •  ')
    if (contact) doc.text(contact, PW / 2, PH - 6, { align: 'center' })
  }

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-ParchmentScroll.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 8 — Dual Heritage
// Landscape A4, single page, 4×3 grid. Hebrew month name is the dominant header
// text (gold, large), English below. Israeli blue + warm gold palette.
// ─────────────────────────────────────────────────────────────────────────────
async function exportDualHeritage(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const BLUE   = '#1C3557'
  const GOLD   = '#C5922A'
  const [bR, bG, bB] = hexToRgbLocal(BLUE)
  const [gR, gG, gB] = hexToRgbLocal(GOLD)

  const PW = 297, PH = 210
  const MARGIN = 7
  const COL = 4, ROWS = 3
  const months = getAcademicMonths(settings.academicYear)
  const roshChodeshMap = getRoshChodeshMap(settings.academicYear)
  const HEADER_H = 14

  // Page header
  doc.setFillColor(bR, bG, bB)
  doc.rect(0, 0, PW, HEADER_H, 'F')
  doc.setFillColor(gR, gG, gB)
  doc.rect(0, HEADER_H - 1.5, PW, 1.5, 'F')

  const schoolName = schoolInfo.name || 'School Calendar'
  doc.setFont(titleFont, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(schoolName, MARGIN + 15, 9, { baseline: 'middle' })
  doc.setFontSize(5.5)
  doc.setTextColor(gR, gG, gB)
  doc.text(settings.academicYear?.replace('-', '–') || '', PW - MARGIN, 9, { align: 'right', baseline: 'middle' })

  if (schoolInfo.logo) {
    try {
      const shaped = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(shaped, 'PNG', MARGIN, 1.5, 11, 11)
    } catch {}
  }

  const gridTop = HEADER_H + 2
  const monthW = (PW - MARGIN * 2) / COL - 2
  const monthH = (PH - gridTop - MARGIN) / ROWS - 2

  months.forEach(({ year, month }, idx) => {
    const col = idx % COL
    const row = Math.floor(idx / COL)
    const mx = MARGIN + col * (monthW + 2)
    const my = gridTop + row * (monthH + 2)

    // Month header — Hebrew name dominant (large gold), English smaller (white)
    doc.setFillColor(bR, bG, bB)
    doc.roundedRect(mx, my, monthW, 10, 1, 1, 'F')

    const hebrewLabel = getHebrewMonthLabel(year, month)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(gR, gG, gB)
    doc.text(hebrewLabel, mx + monthW / 2, my + 4.5, { align: 'center' })

    const engLabel = new Date(year, month, 1).toLocaleString('default', { month: 'short' }) + ' ' + year
    doc.setFontSize(5)
    doc.setTextColor(200, 220, 255)
    doc.text(engLabel, mx + monthW / 2, my + 8.5, { align: 'center' })

    // Day headers
    const DAY_H = 4.5
    const cellW = monthW / 7
    const firstDay = getFirstDayOfWeek(year, month)
    const daysInMonth = getDaysInMonth(year, month)
    const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    DAY_ABBR.forEach((d, i) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(4)
      doc.setTextColor(i === 6 ? gR : bR, i === 6 ? gG : bG, i === 6 ? gB : bB)
      doc.text(d, mx + i * cellW + cellW / 2, my + 10 + DAY_H * 0.75, { align: 'center' })
    })

    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    const rows = totalCells / 7
    const cellH = (monthH - 10 - DAY_H) / rows

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDay + 1
      const col2 = i % 7
      const row2 = Math.floor(i / 7)
      const cx = mx + col2 * cellW
      const cy = my + 10 + DAY_H + row2 * cellH
      const dateKey = dayNum >= 1 && dayNum <= daysInMonth ? formatDateKey(year, month, dayNum) : null

      if (!dateKey) continue

      // Rosh Chodesh: gold crescent arc instead of background
      if (roshChodeshMap[dateKey]) {
        doc.setDrawColor(gR, gG, gB)
        doc.setLineWidth(0.4)
        doc.ellipse(cx + cellW - 1.5, cy + 1, 1, 1.2)
      }

      // Shabbat column
      if (col2 === 6) {
        doc.setFillColor(230, 238, 250)
        doc.rect(cx, cy, cellW, cellH, 'F')
      }

      doc.setDrawColor(200, 210, 225)
      doc.setLineWidth(0.1)
      doc.rect(cx, cy, cellW, cellH)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(4.5)
      doc.setTextColor(bR, bG, bB)
      doc.text(String(dayNum), cx + 1, cy + 3.5)

      const dayEvents = (events[dateKey] || []).slice(0, 2)
      dayEvents.forEach((ev, ei) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 0.5, cy + 4.5 + ei * 3.5, cellW - 1, 3, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(2.8)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1, cy + 6.5 + ei * 3.5, { maxWidth: cellW - 2 })
      })
    }
  })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-DualHeritage.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 9 — Regal Triptych
// Landscape A4, single page. 3 vertical term columns separated by gold rules.
// Columns: Elul Zman (Aug–Nov), Winter Zman (Dec–Mar), Spring Zman (Apr–Jun).
// Deep navy + antique gold.
// ─────────────────────────────────────────────────────────────────────────────
async function exportRegalTriptych(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const NAVY = '#1A3A5C'
  const GOLD = '#B8943F'
  const [nR, nG, nB] = hexToRgbLocal(NAVY)
  const [gR, gG, gB] = hexToRgbLocal(GOLD)

  const PW = 297, PH = 210
  const MARGIN = 7
  const HEADER_H = 14

  // Page header
  doc.setFillColor(nR, nG, nB)
  doc.rect(0, 0, PW, HEADER_H, 'F')
  doc.setFillColor(gR, gG, gB)
  doc.rect(0, HEADER_H - 1.5, PW, 1.5, 'F')

  const schoolName = schoolInfo.name || 'School Calendar'
  doc.setFont(titleFont, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(schoolName, MARGIN + 15, 9, { baseline: 'middle' })
  doc.setFontSize(5)
  doc.setTextColor(gR, gG, gB)
  doc.text(settings.academicYear?.replace('-', '–') || '', PW - MARGIN, 9, { align: 'right', baseline: 'middle' })

  if (schoolInfo.logo) {
    try {
      const shaped = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(shaped, 'PNG', MARGIN, 1.5, 11, 11)
    } catch {}
  }

  const months = getAcademicMonths(settings.academicYear)
  const roshChodeshMap = getRoshChodeshMap(settings.academicYear)

  // Three terms
  const TERMS = [
    { label: 'FIRST TERM', subLabel: 'ELUL ZMAN',   indices: [0, 1, 2, 3]  },  // Aug–Nov
    { label: 'SECOND TERM', subLabel: 'WINTER ZMAN', indices: [4, 5, 6, 7]  },  // Dec–Mar
    { label: 'THIRD TERM',  subLabel: 'SPRING ZMAN', indices: [8, 9, 10]    },  // Apr–Jun
  ]

  const colW = (PW - MARGIN * 2) / 3
  const gridTop = HEADER_H + 2

  TERMS.forEach((term, ti) => {
    const colX = MARGIN + ti * colW
    const termMonths = term.indices.map(i => months[i]).filter(Boolean)

    // Term header band
    doc.setFillColor(nR, nG, nB)
    doc.rect(colX, gridTop, colW, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(gR, gG, gB)
    doc.text(term.label, colX + colW / 2, gridTop + 4, { align: 'center' })
    doc.setFontSize(4.5)
    doc.setTextColor(180, 200, 230)
    doc.text(term.subLabel, colX + colW / 2, gridTop + 8, { align: 'center' })

    // Gold vertical divider (except after last column)
    if (ti < 2) {
      doc.setDrawColor(gR, gG, gB)
      doc.setLineWidth(0.6)
      doc.line(colX + colW, gridTop, colX + colW, PH - MARGIN)
    }

    // Months within this column
    const monthH = (PH - gridTop - MARGIN - 10) / termMonths.length
    const monthW = colW - 2

    termMonths.forEach(({ year, month }, mi) => {
      const mx = colX + 1
      const my = gridTop + 10 + mi * monthH

      // Month sub-header
      const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
      const hebrewLabel = getHebrewMonthLabel(year, month)
      doc.setFillColor(Math.min(255, nR + 15), Math.min(255, nG + 20), Math.min(255, nB + 30))
      doc.rect(mx, my, monthW, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(255, 255, 255)
      doc.text(monthName + ' ' + year, mx + 2, my + 4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(4)
      doc.setTextColor(gR, gG, gB)
      doc.text(hebrewLabel, mx + monthW - 2, my + 4, { align: 'right' })

      // Day labels
      const cellW = monthW / 7
      const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      DAY_ABBR.forEach((d, i) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(3.5)
        doc.setTextColor(i === 6 ? gR : 100, i === 6 ? gG : 110, i === 6 ? gB : 120)
        doc.text(d, mx + i * cellW + cellW / 2, my + 9, { align: 'center' })
      })

      const firstDay = getFirstDayOfWeek(year, month)
      const daysInMonth = getDaysInMonth(year, month)
      const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
      const rows = totalCells / 7
      const cellH = (monthH - 10) / rows

      for (let i = 0; i < totalCells; i++) {
        const dayNum = i - firstDay + 1
        const c = i % 7
        const r = Math.floor(i / 7)
        const cx = mx + c * cellW
        const cy = my + 10 + r * cellH
        const dateKey = dayNum >= 1 && dayNum <= daysInMonth ? formatDateKey(year, month, dayNum) : null

        if (c === 6 && dateKey) {
          doc.setFillColor(235, 240, 250)
          doc.rect(cx, cy, cellW, cellH, 'F')
        }
        doc.setDrawColor(200, 208, 220)
        doc.setLineWidth(0.1)
        doc.rect(cx, cy, cellW, cellH)

        if (!dateKey) continue

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(4)
        doc.setTextColor(nR, nG, nB)
        doc.text(String(dayNum), cx + 0.8, cy + 3)

        const dayEvents = (events[dateKey] || []).slice(0, 2)
        dayEvents.forEach((ev, ei) => {
          const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
          doc.setFillColor(er, eg, eb)
          doc.rect(cx + 0.3, cy + 3.5 + ei * 3, cellW - 0.6, 2.8, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(2.5)
          doc.setFont('helvetica', 'normal')
          doc.text(ev.label, cx + 0.6, cy + 5.5 + ei * 3, { maxWidth: cellW - 1 })
        })
      }
    })
  })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-RegalTriptych.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 10 — Photo Showcase
// Landscape A4, 11 pages (one per month). Top 65mm = school photo banner.
// If no bannerImage: gradient fill + diagonal line texture fallback.
// ─────────────────────────────────────────────────────────────────────────────
async function exportPhotoShowcase(state, { preview, monthIndex = null }) {
  const { events, categories, schoolInfo, settings } = state
  const theme = getTheme(settings.theme, settings.customPrimary, settings.customAccent)
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)

  const PW = 297, PH = 210
  const MARGIN = 8
  const BANNER_H = 60
  const HEADER_OVERLAY_H = 18

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await loadMontserrat(doc)

  const months = getAcademicMonths(settings.academicYear)
  const roshChodeshMap = getRoshChodeshMap(settings.academicYear)
  const holidayMap     = getHolidayMap    (settings.academicYear)
  const shabbatLabel   = settings.shabbatLabel || 'Shabbat'

  const monthList = monthIndex != null ? [months[monthIndex]] : months

  for (let pageIdx = 0; pageIdx < monthList.length; pageIdx++) {
    if (pageIdx > 0) doc.addPage()
    const { year, month } = monthList[pageIdx]

    // ── Banner ──
    if (schoolInfo.bannerImage) {
      try {
        doc.addImage(schoolInfo.bannerImage, 'JPEG', 0, 0, PW, BANNER_H)
      } catch {
        // fallback if image fails
        doc.setFillColor(Math.min(255, pr + 20), Math.min(255, pg + 30), Math.min(255, pb + 40))
        doc.rect(0, 0, PW, BANNER_H, 'F')
      }
    } else {
      // Gradient simulation: two overlapping rects
      doc.setFillColor(pr, pg, pb)
      doc.rect(0, 0, PW, BANNER_H, 'F')
      doc.setFillColor(Math.min(255, pr + 30), Math.min(255, pg + 35), Math.min(255, pb + 45))
      doc.rect(PW * 0.4, 0, PW * 0.6, BANNER_H, 'F')
      // Diagonal gold line texture
      doc.setDrawColor(ar, ag, ab)
      doc.setLineWidth(0.3)
      for (let lx = -BANNER_H; lx < PW + BANNER_H; lx += 8) {
        doc.line(lx, 0, lx + BANNER_H, BANNER_H)
      }
    }

    // Semi-transparent primary band over banner bottom for month name
    doc.setFillColor(pr, pg, pb)
    doc.saveGraphicsState()
    // Approximate opacity by blending: draw a rect then overlay text
    doc.rect(0, BANNER_H - HEADER_OVERLAY_H, PW, HEADER_OVERLAY_H, 'F')
    doc.restoreGraphicsState()

    // Month title over the band
    const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hebrewLabel = getHebrewMonthLabel(year, month)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text(monthName + ' ' + year, MARGIN, BANNER_H - 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(ar, ag, ab)
    doc.text(hebrewLabel, MARGIN, BANNER_H - 1)

    // School name top-left of banner
    const schoolName = schoolInfo.name || 'School Calendar'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    doc.text(schoolName, MARGIN + 14, 9)
    if (schoolInfo.logo) {
      try {
        const shaped = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
        doc.addImage(shaped, 'PNG', MARGIN, 2, 12, 12)
      } catch {}
    }

    // ── Grid below banner ──
    const gridTop = BANNER_H + 3
    const gridH = PH - gridTop - MARGIN + 2
    const cellW = (PW - MARGIN * 2) / 7
    const firstDay = getFirstDayOfWeek(year, month)
    const daysInMonth = getDaysInMonth(year, month)
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    const rows = totalCells / 7
    const cellH = gridH / rows

    // Day headers
    const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', shabbatLabel]
    DAY_LABELS.forEach((d, i) => {
      doc.setFillColor(i === 6 ? pr : (i === 5 ? Math.min(255,pr+20) : 245), i === 6 ? pg : 245, i === 6 ? pb : 247)
      doc.rect(MARGIN + i * cellW, gridTop, cellW, 5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(4)
      doc.setTextColor(i === 6 ? 255 : pr, i === 6 ? 255 : pg, i === 6 ? 255 : pb)
      doc.text(d.slice(0, 3).toUpperCase(), MARGIN + i * cellW + cellW / 2, gridTop + 3.5, { align: 'center' })
    })

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDay + 1
      const col = i % 7
      const row = Math.floor(i / 7)
      const cx = MARGIN + col * cellW
      const cy = gridTop + 5 + row * cellH
      const dateKey = dayNum >= 1 && dayNum <= daysInMonth ? formatDateKey(year, month, dayNum) : null

      if (col === 6 && dateKey) {
        doc.setFillColor(Math.min(255, pr + 195), Math.min(255, pg + 200), Math.min(255, pb + 210))
        doc.rect(cx, cy, cellW, cellH, 'F')
      }
      doc.setDrawColor(210, 215, 225)
      doc.setLineWidth(0.15)
      doc.rect(cx, cy, cellW, cellH)

      if (!dateKey) continue

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(pr, pg, pb)
      doc.text(String(dayNum), cx + 1.5, cy + 5)

      const holiday = holidayMap[dateKey]
      if (holiday) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(4)
        doc.setTextColor(ar, ag, ab)
        const label = settings.shabbatLabel === 'Shabbos' ? holiday.ashkenaz : holiday.sephardi
        doc.text(label, cx + cellW / 2, cy + 10, { align: 'center', maxWidth: cellW - 2 })
      }

      const dayEvents = (events[dateKey] || []).slice(0, 3)
      dayEvents.forEach((ev, ei) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 1, cy + 13 + ei * 5, cellW - 2, 4, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3.5)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1.5, cy + 16.2 + ei * 5, { maxWidth: cellW - 3 })
      })
    }
  }

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-PhotoShowcase.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 11 — Hebrew Date Focus
// Landscape A4, single page, 4×3 grid. Every day cell shows both the Gregorian
// date (top-left) AND the Hebrew date number (bottom-right, in gold).
// Rosh Chodesh gets a thick gold left-edge line instead of background fill.
// ─────────────────────────────────────────────────────────────────────────────
async function exportHebrewDateFocus(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)

  const PW = 297, PH = 210
  const MARGIN = 7
  const HEADER_H = 14
  const COL = 4, ROWS = 3
  const months = getAcademicMonths(settings.academicYear)
  const roshChodeshMap = getRoshChodeshMap(settings.academicYear)
  const holidayMap     = getHolidayMap    (settings.academicYear)

  // Page header
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, PW, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, HEADER_H - 1.5, PW, 1.5, 'F')

  const schoolName = schoolInfo.name || 'School Calendar'
  doc.setFont(titleFont, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(schoolName, MARGIN + 15, 9, { baseline: 'middle' })
  doc.setFontSize(5)
  doc.setTextColor(ar, ag, ab)
  doc.text(settings.academicYear?.replace('-', '–') || '', PW - MARGIN, 9, { align: 'right', baseline: 'middle' })

  // "Hebrew Dates" subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(180, 210, 255)
  doc.text('Hebrew / Gregorian Date Reference', PW / 2, 9, { align: 'center', baseline: 'middle' })

  if (schoolInfo.logo) {
    try {
      const shaped = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(shaped, 'PNG', MARGIN, 1.5, 11, 11)
    } catch {}
  }

  const gridTop = HEADER_H + 2
  const monthW = (PW - MARGIN * 2) / COL - 2
  const monthH = (PH - gridTop - MARGIN) / ROWS - 2

  months.forEach(({ year, month }, idx) => {
    const col = idx % COL
    const row = Math.floor(idx / COL)
    const mx = MARGIN + col * (monthW + 2)
    const my = gridTop + row * (monthH + 2)

    // Month header
    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(mx, my, monthW, 8, 1, 1, 'F')
    const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hebrewLabel = getHebrewMonthLabel(year, month)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(255, 255, 255)
    doc.text(monthName + ' ' + year, mx + 2, my + 5.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.5)
    doc.setTextColor(ar, ag, ab)
    doc.text(hebrewLabel, mx + monthW - 2, my + 5.5, { align: 'right' })

    // Day headers
    const cellW = monthW / 7
    const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', shabbatLabel.slice(0, 1)]
    DAY_ABBR.forEach((d, i) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(3.8)
      doc.setTextColor(i === 6 ? pr : 80, i === 6 ? pg : 85, i === 6 ? pb : 95)
      doc.text(d, mx + i * cellW + cellW / 2, my + 11.5, { align: 'center' })
    })

    const firstDay = getFirstDayOfWeek(year, month)
    const daysInMonth = getDaysInMonth(year, month)
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    const rows = totalCells / 7
    const cellH = (monthH - 12) / rows

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDay + 1
      const c = i % 7
      const r = Math.floor(i / 7)
      const cx = mx + c * cellW
      const cy = my + 12 + r * cellH
      const dateKey = dayNum >= 1 && dayNum <= daysInMonth ? formatDateKey(year, month, dayNum) : null

      if (c === 6 && dateKey) {
        doc.setFillColor(Math.min(255, pr + 195), Math.min(255, pg + 200), Math.min(255, pb + 210))
        doc.rect(cx, cy, cellW, cellH, 'F')
      }
      doc.setDrawColor(200, 208, 220)
      doc.setLineWidth(0.1)
      doc.rect(cx, cy, cellW, cellH)

      if (!dateKey) continue

      // Rosh Chodesh: thick gold left-edge instead of background
      if (roshChodeshMap[dateKey]) {
        doc.setDrawColor(ar, ag, ab)
        doc.setLineWidth(1.2)
        doc.line(cx, cy, cx, cy + cellH)
        doc.setLineWidth(0.1)
      }

      // Gregorian date top-left (small, blue-gray)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(4.5)
      doc.setTextColor(pr, pg, pb)
      doc.text(String(dayNum), cx + 1, cy + 3.5)

      // Hebrew date bottom-right (gold)
      const hebrewDay = getHebrewDayNumber(dateKey)
      if (hebrewDay != null) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(3.2)
        doc.setTextColor(ar, ag, ab)
        doc.text(String(hebrewDay), cx + cellW - 1, cy + cellH - 0.8, { align: 'right' })
      }

      // Events
      const dayEvents = (events[dateKey] || []).slice(0, 2)
      dayEvents.forEach((ev, ei) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 0.5, cy + 4 + ei * 3.5, cellW - 1, 3, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(2.6)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1, cy + 6.2 + ei * 3.5, { maxWidth: cellW - 2 })
      })
    }
  })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-HebrewDateFocus.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 12 — Elegant Feminine
// Portrait A4, 11 pages (one per month). Plum + champagne gold, warm off-white
// background, diamond band decoration, lavender Shabbat column. 4 events/cell.
// ─────────────────────────────────────────────────────────────────────────────
async function exportElegantFeminine(state, { preview, monthIndex = null }) {
  const { events, categories, schoolInfo, settings } = state
  const PLUM   = '#7B4F72'
  const CHAMP  = '#C8A97E'
  const BG     = '#FDFAF6'
  const LAVENDER = '#F3EDF8'
  const BORDER = '#E2D5E8'
  const [pR, pG, pB]   = hexToRgbLocal(PLUM)
  const [chR, chG, chB] = hexToRgbLocal(CHAMP)
  const [bgR, bgG, bgB] = hexToRgbLocal(BG)
  const [lvR, lvG, lvB] = hexToRgbLocal(LAVENDER)
  const [bdR, bdG, bdB] = hexToRgbLocal(BORDER)

  const PW = 210, PH = 297  // A4 portrait
  const MARGIN = 12
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await loadMontserrat(doc)

  const months = getAcademicMonths(settings.academicYear)
  const roshChodeshMap = getRoshChodeshMap(settings.academicYear)
  const holidayMap     = getHolidayMap    (settings.academicYear)
  const shabbatLabel   = settings.shabbatLabel || 'Shabbat'

  const monthList = monthIndex != null ? [months[monthIndex]] : months

  for (let pageIdx = 0; pageIdx < monthList.length; pageIdx++) {
    const { year, month } = monthList[pageIdx]
    if (pageIdx > 0) doc.addPage()

    // Warm off-white background
    doc.setFillColor(bgR, bgG, bgB)
    doc.rect(0, 0, PW, PH, 'F')

    // ── Header ──
    doc.setFillColor(pR, pG, pB)
    doc.rect(0, 0, PW, 22, 'F')

    const schoolName = schoolInfo.name || 'School Calendar'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(chR, chG, chB)
    doc.text(schoolName.toUpperCase(), PW / 2, 7, { align: 'center' })

    const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hebrewLabel = getHebrewMonthLabel(year, month)
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text(monthName + ' ' + year, PW / 2, 15, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(chR, chG, chB)
    doc.text(hebrewLabel, PW / 2, 20, { align: 'center' })

    if (schoolInfo.logo) {
      try {
        const shaped = await cropLogoImage(schoolInfo.logo, 'rounded')
        doc.addImage(shaped, 'PNG', MARGIN, 4, 12, 12)
      } catch {}
    }

    // ── Diamond band decoration between header and grid ──
    drawDecorativeDiamondBand(doc, 26, PW, [pR, pG, pB], [chR, chG, chB], MARGIN)

    // ── Grid ──
    const gridTop = 30
    const gridH = PH - gridTop - MARGIN - 4
    const cellW = (PW - MARGIN * 2) / 7
    const firstDay = getFirstDayOfWeek(year, month)
    const daysInMonth = getDaysInMonth(year, month)
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
    const rows = totalCells / 7
    const cellH = gridH / rows

    // Day headers
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', shabbatLabel.slice(0, 3)]
    DAY_LABELS.forEach((d, i) => {
      const hx = MARGIN + i * cellW
      doc.setFillColor(i === 6 ? pR : Math.min(255, pR + 140), i === 6 ? pG : Math.min(255, pG + 120), i === 6 ? pB : Math.min(255, pB + 130))
      doc.rect(hx, gridTop, cellW, 5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(4.5)
      doc.setTextColor(i === 6 ? 255 : pR, i === 6 ? 255 : pG, i === 6 ? 255 : pB)
      doc.text(d, hx + cellW / 2, gridTop + 3.5, { align: 'center' })
    })

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDay + 1
      const col = i % 7
      const row = Math.floor(i / 7)
      const cx = MARGIN + col * cellW
      const cy = gridTop + 5 + row * cellH
      const dateKey = dayNum >= 1 && dayNum <= daysInMonth ? formatDateKey(year, month, dayNum) : null

      // Shabbat column lavender bg
      if (col === 6 && dateKey) {
        doc.setFillColor(lvR, lvG, lvB)
        doc.rect(cx, cy, cellW, cellH, 'F')
      }

      // Cell border — soft lavender-gray
      doc.setDrawColor(bdR, bdG, bdB)
      doc.setLineWidth(0.2)
      doc.rect(cx, cy, cellW, cellH)

      if (!dateKey) continue

      // Day number
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(pR, pG, pB)
      doc.text(String(dayNum), cx + 1.5, cy + 5)

      // Rosh Chodesh indicator
      if (roshChodeshMap[dateKey]) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(3.5)
        doc.setTextColor(chR, chG, chB)
        doc.text('ר"ח', cx + cellW - 1.5, cy + 4.5, { align: 'right' })
      }

      // Holiday
      const holiday = holidayMap[dateKey]
      if (holiday) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(3.8)
        doc.setTextColor(pR, pG, pB)
        const label = settings.shabbatLabel === 'Shabbos' ? holiday.ashkenaz : holiday.sephardi
        doc.text(label, cx + cellW / 2, cy + 10, { align: 'center', maxWidth: cellW - 2 })
      }

      // Up to 4 events (taller portrait cells allow it)
      const dayEvents = (events[dateKey] || []).slice(0, 4)
      dayEvents.forEach((ev, ei) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 1, cy + 12 + ei * 4.5, cellW - 2, 3.8, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1.5, cy + 14.8 + ei * 4.5, { maxWidth: cellW - 3 })
      })
    }

    // Footer with contact
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4)
    doc.setTextColor(pR, pG, pB)
    if (schoolInfo.address) doc.text(schoolInfo.address, PW / 2, PH - 9, { align: 'center' })
    const contact = [schoolInfo.phone, schoolInfo.email].filter(Boolean).join('  •  ')
    if (contact) doc.text(contact, PW / 2, PH - 6, { align: 'center' })
    if (schoolInfo.website) {
      doc.setTextColor(chR, chG, chB)
      doc.text(schoolInfo.website, PW / 2, PH - 3, { align: 'center' })
    }
  }

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-ElegantFeminine.pdf`)
}
