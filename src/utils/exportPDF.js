import { jsPDF } from 'jspdf'
import { loadMontserrat } from './pdfFonts.js'
import { ACADEMIC_MONTHS } from '../hooks/useKeyboardNav.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel } from './dateUtils.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'
import { ROSH_CHODESH_MAP } from '../data/hebrewCalendar.js'
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

// Crop an image to a circle using canvas (for round logo in PDF)
async function circularCropImage(base64) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.clip()
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
    const rcMonth = ROSH_CHODESH_MAP[dateKey]

    // Shabbat background — always apply theme tint first
    if (dow === 6) {
      doc.setFillColor(sr, sg, sb)
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
      doc.setFontSize(4 * s)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, cy + 2.5 * s)
      doc.setFont('helvetica', 'normal')
    } else {
      // Dot mode — day number + dots
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(4 * s)
      doc.text(String(dayNum), cx + 0.8, cy + 2.5 * s)
      dayEvs.slice(0, 3).forEach((ev, idx) => {
        const cat = catMap[ev.category]
        const color = ev.color || cat?.color || '#999999'
        const [r, g, b] = hexToRgb(color)
        doc.setFillColor(r, g, b)
        doc.circle(cx + 1 + idx * 1.6, cy + cellH - 1.5, 0.6 * s, 'F')
      })
    }

    // Cell border — thin faint line around every day cell
    doc.setDrawColor(200, 200, 205)
    doc.setLineWidth(0.15)
    doc.rect(cx, cy, cellW, cellH, 'S')

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
function computeMaxEventsPerMonth(events) {
  return Math.max(...ACADEMIC_MONTHS.map(({ year, month }) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const seen = new Set()
    Object.entries(events).forEach(([dk, evs]) => {
      if (!dk.startsWith(monthKey)) return
      ;(evs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => seen.add(`${ev.category}::${ev.label}`))
    })
    return seen.size
  }), 0)
}

function drawBottomEventsPanel(doc, events, categories, y, pageW, margin, sidebarW, panelH) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

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
  const colW = panelW / ACADEMIC_MONTHS.length
  const MONTH_ABBR = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']

  ACADEMIC_MONTHS.forEach(({ year, month }, mi) => {
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

export async function exportPDF(state, { preview = false, pdfStyle = 'classic' } = {}) {
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
  if (pdfStyle === 'portrait-monthly') return exportMonthlyPortrait(state, ctx)
  if (pdfStyle === 'year-at-a-glance') return exportYearAtAGlance(state, ctx)
  if (pdfStyle === 'dark-elegant')     return exportDarkElegant(state, ctx)
  if (pdfStyle === 'bulletin-board')   return exportBulletinBoard(state, ctx)
  // default: classic
  const isCompact = settings.template === 'compact'

  // Layout measurements
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / COL_COUNT) - 2
  const MONTH_ROWS = 3
  // Dynamic bottom panel height: grows to fit the busiest month (capped at 90mm)
  const maxEvPerMonth = showBottomPanel ? computeMaxEventsPerMonth(events) : 0
  const dynamicPanelH = showBottomPanel
    ? Math.min(Math.max(BOTTOM_PANEL_H, 11 + maxEvPerMonth * 4 + 4), 90)
    : 0
  // Dynamic inline notes strip height: grows per-event count, capped at 20mm
  // Each event line ≈ 2.1mm + 3mm header. Cells need at least 4mm each (24mm for 6 rows).
  const maxInlineEvents = !showBottomPanel && !isCompact ? computeMaxEventsPerMonth(events) : 0
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
      const circularLogo = await circularCropImage(schoolInfo.logo)
      doc.addImage(circularLogo, 'PNG', MARGIN, 2, 13, 13)
    } catch {}
  }

  // Gold left accent bar before logo
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, 0, 3, HEADER_H - 1.5, 'F')

  // School name — ACCENT color, prominent
  doc.setTextColor(ar, ag, ab)
  doc.setFontSize(12)
  doc.setFont(titleFont, 'bold')
  doc.text(schoolInfo.name || 'YAYOE Calendar', MARGIN + 16, 9)
  // Secondary line — all WHITE, all same size: "Academic Year  2026–2027  •  5787"
  doc.setFontSize(7)
  doc.setFont(titleFont, 'normal')
  doc.setTextColor(255, 255, 255)
  const hebrewYear = settings.hebrewYear || '5787'
  doc.text(`Academic Year  ${settings.academicYear || '2026–2027'}  •  ${hebrewYear}`, MARGIN + 16, 14)

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

  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    const col = idx % COL_COUNT
    const row = Math.floor(idx / COL_COUNT)
    const x = MARGIN + col * (MONTH_W + 2)
    const y = startY + row * (MONTH_H + 3)
    drawMonth(doc, { year, month }, events, categories, settings, x, y, MONTH_W, MONTH_H, shabbatLabel, globalNotesStripH, theme)
  })

  // ── Bottom Events Panel ──────────────────────────────
  if (showBottomPanel) {
    const panelTop = startY + MONTH_ROWS * (MONTH_H + 3) + 2
    drawBottomEventsPanel(doc, events, categories, panelTop, PAGE_W, MARGIN, SIDEBAR_W, dynamicPanelH)
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

  // ── SCHOOL HOURS section ──
  const hoursY = sbTop + titleStripH + 7
  doc.setTextColor(pr, pg, pb)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('SCHOOL HOURS', sbCx, hoursY, { align: 'center' })
  // Accent underline rule
  const ruleW = SIDEBAR_W * 0.78
  doc.setDrawColor(ar, ag, ab)
  doc.setLineWidth(0.5)
  doc.line(sbCx - ruleW / 2, hoursY + 1.8, sbCx + ruleW / 2, hoursY + 1.8)

  const hourLines = (schoolInfo.hours || 'Boys: 8:30 AM – 4:30 PM\nGirls: 8:30 AM – 3:30 PM\nFriday: 8:30 AM – 1:30 PM').split('\n')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(50, 60, 80)
  hourLines.forEach((line, i) => {
    doc.text(line.trim(), sbCx, hoursY + 7 + i * 5.5, { align: 'center' })
  })

  // ── Full-width accent divider ──
  const midDivY = hoursY + 7 + hourLines.length * 5.5 + 4
  doc.setDrawColor(ar, ag, ab)
  doc.setLineWidth(0.5)
  doc.line(sbX + 3, midDivY, sbX + SIDEBAR_W - 3, midDivY)

  // ── LEGEND section ──
  const legendHeadY = midDivY + 6
  doc.setTextColor(pr, pg, pb)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('LEGEND', sbCx, legendHeadY, { align: 'center' })
  // Accent underline rule
  doc.setDrawColor(ar, ag, ab)
  doc.setLineWidth(0.5)
  doc.line(sbCx - ruleW / 2, legendHeadY + 1.8, sbCx + ruleW / 2, legendHeadY + 1.8)

  const addrBlockH = 26
  const legendStartY = legendHeadY + 6
  const visibleCats = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
  const legendItemH = 5.5
  visibleCats.forEach((cat, idx) => {
    const [r, g, b] = hexToRgb(cat.color)
    const itemY = legendStartY + idx * legendItemH
    // Rectangular swatch (matches reference PDF style)
    doc.setFillColor(r, g, b)
    doc.rect(sbX + 5, itemY - 2.5, 5, 3.2, 'F')
    doc.setTextColor(40, 50, 70)
    doc.setFontSize(5)
    doc.setFont('helvetica', 'normal')
    doc.text(cat.name, sbX + 12, itemY, { maxWidth: SIDEBAR_W - 14 })
  })


  // ── Contact block (anchored to bottom) ──
  const addrY = sbTop + sbH - addrBlockH + 3
  doc.setDrawColor(ar, ag, ab)
  doc.setLineWidth(0.5)
  doc.line(sbX + 3, addrY - 4, sbX + SIDEBAR_W - 3, addrY - 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.setTextColor(60, 70, 90)
  doc.text(schoolInfo.address || '241 S. Detroit St., Los Angeles, CA 90036', sbCx, addrY, { align: 'center', maxWidth: SIDEBAR_W - 6 })
  doc.text(`Tel: ${schoolInfo.phone || '323-556-6900'}`, sbCx, addrY + 5, { align: 'center' })
  doc.text(`Fax: ${schoolInfo.fax || '323-556-6901'}`, sbCx, addrY + 10, { align: 'center' })
  doc.setTextColor(42, 100, 180)
  doc.text(schoolInfo.website || 'www.yayoe.org', sbCx, addrY + 15, { align: 'center' })

  if (preview) return doc.output('bloburl')
  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}-${pdfStyle}.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 2: CLEAN MINIMAL — no sidebar, white bg, thin grid
// ────────────────────────────────────────────────────────────────────────────
async function exportMinimal(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 10
  const GRID_W = PAGE_W - MARGIN * 2
  const MONTH_W = (GRID_W / 4) - 3
  const HEADER_H = 14
  const MONTH_H = (PAGE_H - HEADER_H - MARGIN * 2 - 12) / 3

  // Minimal white header
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F')
  doc.setDrawColor(pr, pg, pb)
  doc.setLineWidth(1.5)
  doc.line(0, HEADER_H, PAGE_W, HEADER_H)
  doc.setTextColor(pr, pg, pb)
  doc.setFontSize(10); doc.setFont(titleFont, 'bold')
  doc.text(schoolInfo.name || 'Academic Calendar', MARGIN, 9)
  doc.setFontSize(7); doc.setFont(titleFont, 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(settings.academicYear || '2026-2027', PAGE_W - MARGIN, 9, { align: 'right' })

  // Draft watermark
  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 4
  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + col * (MONTH_W + 3)
    const y = startY + row * (MONTH_H + 4)
    // Month label — colored bar, no sidebar
    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(x, y, MONTH_W, 7, 1, 1, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont(titleFont, 'bold')
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    doc.text(`${mName} ${year}`, x + 2, y + 4.5)
    // Day column headers
    const cellW = MONTH_W / 7
    const labelY = y + 10.5
    DAYS.forEach((d, i) => {
      doc.setTextColor(i === 6 ? pr : 150, i === 6 ? pg : 150, i === 6 ? pb : 150)
      doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
      doc.text(i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d, x + i * cellW + cellW / 2, labelY, { align: 'center' })
    })
    // Thin rule
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2)
    doc.line(x, labelY + 1, x + MONTH_W, labelY + 1)
    // Days grid
    const daysInMonth = getDaysInMonth(year, month)
    const firstDow = getFirstDayOfWeek(year, month)
    const cellH = (MONTH_H - 13) / 6
    for (let day = 1; day <= daysInMonth; day++) {
      const slot = day + firstDow - 1
      const col2 = slot % 7; const row2 = Math.floor(slot / 7)
      const cx = x + col2 * cellW; const cy = y + 13 + row2 * cellH
      const dateKey = formatDateKey(new Date(year, month, day))
      const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
      // Cell background
      if (col2 === 6) { doc.setFillColor(240, 240, 245); doc.rect(cx, cy, cellW, cellH, 'F') }
      // Day number
      doc.setTextColor(col2 === 6 ? pr : 40, col2 === 6 ? pg : 40, col2 === 6 ? pb : 40)
      doc.setFontSize(4); doc.setFont('helvetica', 'bold')
      doc.text(String(day), cx + 1, cy + 3.5)
      // Event dot
      if (dayEvs.length > 0) {
        const cat = categories.find(c => c.id === dayEvs[0].category)
        const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#999')
        doc.setFillColor(er, eg, eb)
        doc.circle(cx + cellW - 2, cy + 2.5, 1, 'F')
      }
      // Cell border
      doc.setDrawColor(235, 235, 235); doc.setLineWidth(0.1)
      doc.rect(cx, cy, cellW, cellH, 'S')
    }
  })
  // Legend bar at bottom
  const legY = PAGE_H - 8
  doc.setFillColor(248, 248, 250); doc.rect(0, legY - 2, PAGE_W, 10, 'F')
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(0, legY - 2, PAGE_W, legY - 2)
  let legX = MARGIN
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 8).forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb); doc.circle(legX + 1.5, legY + 1.5, 1.5, 'F')
    doc.setTextColor(60, 60, 60); doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
    doc.text(cat.name, legX + 4.5, legY + 2.5)
    legX += doc.getTextWidth(cat.name) + 10
  })
  if (preview) return doc.output('bloburl')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-Minimal.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 3: MONTHLY PORTRAIT — one month per page, portrait A4
// ────────────────────────────────────────────────────────────────────────────
async function exportMonthlyPortrait(state, { preview, theme, doc: _doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 12
  const GRID_W = PAGE_W - MARGIN * 2
  const cellW = GRID_W / 7
  const HEADER_H = 24
  const DAY_HEADER_H = 10
  const GRID_H = PAGE_H - HEADER_H - DAY_HEADER_H - MARGIN * 2 - 20
  const cellH = GRID_H / 6

  // Draft watermark helper
  const drawWatermark = () => {
    if (!settings.draftWatermark) return
    doc.setTextColor(200, 50, 50); doc.setFontSize(80); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.15 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 45 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait')
    drawWatermark()
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hebrewLabel = getHebrewMonthLabel(year, month)
    // Header
    doc.setFillColor(pr, pg, pb); doc.rect(0, 0, PAGE_W, HEADER_H, 'F')
    doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 2, PAGE_W, 2, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont(titleFont, 'bold')
    doc.text(mName, MARGIN, 12)
    doc.setFontSize(9); doc.setFont(titleFont, 'normal')
    doc.text(String(year), MARGIN + doc.getTextWidth(mName) + 2, 12)
    if (hebrewLabel) {
      doc.setFontSize(8); doc.setTextColor(ar, ag, ab)
      doc.text(hebrewLabel, PAGE_W - MARGIN, 12, { align: 'right' })
    }
    doc.setFontSize(7); doc.setTextColor(255, 255, 255, 0.6)
    doc.text(schoolInfo.name || '', PAGE_W - MARGIN, 20, { align: 'right' })
    // Day headers
    const dayY = HEADER_H + 2
    DAYS.forEach((d, i) => {
      if (i === 6) { doc.setFillColor(pr, pg, pb, 0.08); doc.rect(MARGIN + i * cellW, dayY, cellW, DAY_HEADER_H, 'F') }
      doc.setTextColor(i === 6 ? pr : 100, i === 6 ? pg : 100, i === 6 ? pb : 100)
      doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text(i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d, MARGIN + i * cellW + cellW / 2, dayY + 6.5, { align: 'center' })
    })
    // Day cells
    const daysInMonth = getDaysInMonth(year, month)
    const firstDow = getFirstDayOfWeek(year, month)
    for (let day = 1; day <= daysInMonth; day++) {
      const slot = day + firstDow - 1
      const col = slot % 7; const row = Math.floor(slot / 7)
      const cx = MARGIN + col * cellW; const cy = HEADER_H + DAY_HEADER_H + 4 + row * cellH
      const dateKey = formatDateKey(new Date(year, month, day))
      const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
      // Cell bg
      if (col === 6) { doc.setFillColor(pr, pg, pb); doc.setGState(doc.GState({ opacity: 0.06 })); doc.rect(cx, cy, cellW, cellH, 'F'); doc.setGState(doc.GState({ opacity: 1.0 })) }
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.rect(cx, cy, cellW, cellH, 'S')
      // Day number
      doc.setTextColor(col === 6 ? pr : 40, col === 6 ? pg : 40, col === 6 ? pb : 40)
      doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text(String(day), cx + 3, cy + 8)
      // Events
      dayEvs.slice(0, 3).forEach((ev, ei) => {
        const cat = categories.find(c => c.id === ev.category)
        const [er, eg, eb] = hexToRgbLocal(ev.color || cat?.color || '#999')
        doc.setFillColor(er, eg, eb)
        doc.roundedRect(cx + 1, cy + 11 + ei * 7, cellW - 2, 5.5, 0.5, 0.5, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
        doc.text(ev.label, cx + 2.5, cy + 14.5 + ei * 7, { maxWidth: cellW - 4 })
      })
    }
    // Legend at bottom
    const legY = PAGE_H - MARGIN - 12
    doc.setFillColor(248, 248, 250); doc.rect(MARGIN, legY, GRID_W, 12, 'F')
    doc.setDrawColor(pr, pg, pb); doc.setLineWidth(0.5); doc.line(MARGIN, legY, MARGIN + GRID_W, legY)
    let lx = MARGIN + 4
    categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 7).forEach(cat => {
      const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
      doc.setFillColor(cr, cg, cb); doc.rect(lx, legY + 4, 5, 4, 'F')
      doc.setTextColor(60, 60, 60); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal')
      doc.text(cat.name, lx + 7, legY + 7.5)
      lx += doc.getTextWidth(cat.name) + 16
    })
  })
  if (preview) return doc.output('bloburl')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-Monthly.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 4: YEAR AT A GLANCE — all 10 months tiny on one landscape page
// ────────────────────────────────────────────────────────────────────────────
async function exportYearAtAGlance(state, { preview, theme, doc, titleFont }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 5
  const COLS = 5, ROWS = 2
  const MONTH_W = (PAGE_W - MARGIN * 2 - 2) / COLS
  const HEADER_H = 12
  const MONTH_H = (PAGE_H - HEADER_H - MARGIN * 2 - 4) / ROWS

  // Page header
  doc.setFillColor(pr, pg, pb); doc.rect(0, 0, PAGE_W, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 1.5, PAGE_W, 1.5, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont(titleFont, 'bold')
  doc.text(schoolInfo.name || 'Academic Calendar', MARGIN + 2, 7)
  doc.setTextColor(ar, ag, ab); doc.setFontSize(7)
  doc.text(`Year at a Glance  ${settings.academicYear || '2026-2027'}`, PAGE_W - MARGIN - 2, 7, { align: 'right' })

  // Draft watermark
  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    const col = idx % COLS; const row = Math.floor(idx / COLS)
    const mx = MARGIN + col * (MONTH_W + 0.4)
    const my = HEADER_H + 2 + row * (MONTH_H + 2)
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'short' })
    // Month header
    doc.setFillColor(pr, pg, pb); doc.roundedRect(mx, my, MONTH_W, 6, 0.5, 0.5, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(5.5); doc.setFont(titleFont, 'bold')
    doc.text(`${mName} ${year}`, mx + 1.5, my + 4)
    // Day-of-week headers S M T W T F S
    const cellW = MONTH_W / 7
    const headY = my + 8
    'SMTWTFS'.split('').forEach((d, i) => {
      doc.setTextColor(i === 6 ? pr : 120, i === 6 ? pg : 120, i === 6 ? pb : 120)
      doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
      doc.text(d, mx + i * cellW + cellW / 2, headY, { align: 'center' })
    })
    // Days
    const daysInMonth = getDaysInMonth(year, month)
    const firstDow = getFirstDayOfWeek(year, month)
    const cellH = (MONTH_H - 10) / 5
    for (let day = 1; day <= daysInMonth; day++) {
      const slot = day + firstDow - 1
      const dc = slot % 7; const dr = Math.floor(slot / 7)
      const cx = mx + dc * cellW; const cy = my + 10 + dr * cellH
      const dk = formatDateKey(new Date(year, month, day))
      const dayEvs = (events[dk] || []).filter(e => e.category !== 'rosh-chodesh')
      if (dayEvs.length > 0) {
        const cat = categories.find(c => c.id === dayEvs[0].category)
        const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#999')
        doc.setFillColor(er, eg, eb); doc.roundedRect(cx + 0.2, cy + 0.2, cellW - 0.4, cellH - 0.4, 0.3, 0.3, 'F')
        doc.setTextColor(255, 255, 255)
      } else if (dc === 6) {
        doc.setFillColor(pr, pg, pb); doc.setGState(doc.GState({ opacity: 0.07 })); doc.rect(cx, cy, cellW, cellH, 'F'); doc.setGState(doc.GState({ opacity: 1.0 }))
        doc.setTextColor(pr, pg, pb)
      } else { doc.setTextColor(60, 60, 60) }
      doc.setFontSize(3.5); doc.setFont('helvetica', dayEvs.length > 0 ? 'bold' : 'normal')
      doc.text(String(day), cx + cellW / 2, cy + cellH - 0.8, { align: 'center' })
    }
  })
  // Legend
  const legY = PAGE_H - 6
  let lx = MARGIN
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 10).forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb); doc.circle(lx + 1.2, legY + 1.2, 1.2, 'F')
    doc.setTextColor(60, 60, 60); doc.setFontSize(4); doc.setFont('helvetica', 'normal')
    doc.text(cat.name, lx + 4, legY + 2)
    lx += doc.getTextWidth(cat.name) + 9
  })
  if (preview) return doc.output('bloburl')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-YearAtAGlance.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 5: DARK ELEGANT — dark background, light text
// ────────────────────────────────────────────────────────────────────────────
async function exportDarkElegant(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 8, SIDEBAR_W = 50
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / 4) - 2
  const HEADER_H = 18
  const MONTH_H = (PAGE_H - HEADER_H - MARGIN - 6) / 3
  const BG = [18, 24, 40]; const CARD = [28, 36, 58]; const TEXT = [220, 225, 240]; const RULE = [60, 75, 110]

  // Dark background
  doc.setFillColor(...BG); doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  // Accent header line
  doc.setFillColor(ar, ag, ab); doc.rect(0, 0, 4, PAGE_H, 'F')
  doc.setFillColor(...CARD); doc.rect(4, 0, PAGE_W - 4, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(4, HEADER_H - 1, PAGE_W - 4, 1, 'F')
  // Title
  doc.setTextColor(ar, ag, ab); doc.setFontSize(11); doc.setFont(titleFont, 'bold')
  doc.text(schoolInfo.name || 'Academic Calendar', MARGIN + 4, 10)
  doc.setTextColor(...TEXT); doc.setFontSize(7); doc.setFont(titleFont, 'normal')
  doc.text(`Academic Year  ${settings.academicYear || '2026-2027'}`, MARGIN + 4, 15)

  // Draft watermark
  if (settings.draftWatermark) {
    doc.setTextColor(200, 100, 100); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.12 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 2
  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + 4 + col * (MONTH_W + 2.5)
    const y = startY + row * (MONTH_H + 3)
    // Month card bg
    doc.setFillColor(...CARD); doc.roundedRect(x, y, MONTH_W, MONTH_H, 1, 1, 'F')
    // Month header bar (accent)
    doc.setFillColor(ar, ag, ab); doc.roundedRect(x, y, MONTH_W, 7, 1, 1, 'F')
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    doc.setTextColor(...BG); doc.setFontSize(6.5); doc.setFont(titleFont, 'bold')
    doc.text(`${mName} ${year}`, x + 1.5, y + 4.5)
    // Day headers
    const cellW = MONTH_W / 7; const headY = y + 10
    DAYS.forEach((d, i) => {
      const ruleLight = RULE.map(v => Math.min(255, v + 80))
      if (i === 6) doc.setTextColor(ar, ag, ab)
      else doc.setTextColor(ruleLight[0], ruleLight[1], ruleLight[2])
      doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
      doc.text(i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d, x + i * cellW + cellW / 2, headY, { align: 'center' })
    })
    // Days
    const daysInMonth = getDaysInMonth(year, month)
    const firstDow = getFirstDayOfWeek(year, month)
    const cellH = (MONTH_H - 13) / 5
    for (let day = 1; day <= daysInMonth; day++) {
      const slot = day + firstDow - 1
      const dc = slot % 7; const dr = Math.floor(slot / 7)
      const cx = x + dc * cellW; const cy = y + 12 + dr * cellH
      const dk = formatDateKey(new Date(year, month, day))
      const dayEvs = (events[dk] || []).filter(e => e.category !== 'rosh-chodesh')
      // Day bg for Shabbat
      if (dc === 6) { doc.setFillColor(ar, ag, ab); doc.setGState(doc.GState({ opacity: 0.12 })); doc.rect(cx, cy, cellW, cellH, 'F'); doc.setGState(doc.GState({ opacity: 1.0 })) }
      // Event fill
      if (dayEvs.length > 0) {
        const cat = categories.find(c => c.id === dayEvs[0].category)
        const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#999')
        doc.setFillColor(er, eg, eb); doc.roundedRect(cx + 0.3, cy + 0.3, cellW - 0.6, cellH - 0.6, 0.4, 0.4, 'F')
        doc.setTextColor(255, 255, 255)
      } else { doc.setTextColor(...TEXT) }
      doc.setFontSize(4); doc.setFont('helvetica', dayEvs.length > 0 ? 'bold' : 'normal')
      doc.text(String(day), cx + 1, cy + 3.5)
    }
  })
  // Dark sidebar
  const sbX = PAGE_W - MARGIN - SIDEBAR_W
  doc.setFillColor(...CARD); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, PAGE_H - HEADER_H - MARGIN - 2, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, 2, 'F')
  doc.setTextColor(ar, ag, ab); doc.setFontSize(7); doc.setFont(titleFont, 'bold')
  doc.text('LEGEND', sbX + SIDEBAR_W / 2, HEADER_H + 10, { align: 'center' })
  let legY = HEADER_H + 16
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb); doc.roundedRect(sbX + 4, legY - 2.5, 5, 4, 0.5, 0.5, 'F')
    doc.setTextColor(...TEXT); doc.setFontSize(5); doc.setFont('helvetica', 'normal')
    doc.text(cat.name, sbX + 11, legY, { maxWidth: SIDEBAR_W - 14 })
    legY += 7
  })
  if (preview) return doc.output('bloburl')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-DarkElegant.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 6: BULLETIN BOARD — bold color-filled month headers, chunky layout
// ────────────────────────────────────────────────────────────────────────────
async function exportBulletinBoard(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 6, SIDEBAR_W = 50
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / 4) - 2
  const HEADER_H = 16
  const MONTH_H = (PAGE_H - HEADER_H - MARGIN - 6) / 3
  const PALETTE = ['#E63946','#2A9D8F','#E9C46A','#264653','#F4A261','#6A4C93','#43AA8B','#577590','#F8961E','#90BE6D']

  // Colorful header starburst
  for (let i = 0; i < PALETTE.length; i++) {
    const [cr, cg, cb] = hexToRgbLocal(PALETTE[i])
    doc.setFillColor(cr, cg, cb)
    doc.rect((PAGE_W / PALETTE.length) * i, 0, PAGE_W / PALETTE.length, HEADER_H, 'F')
  }
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont(titleFont, 'bold')
  doc.setGState(doc.GState({ opacity: 0.9 }))
  doc.text(schoolInfo.name || 'Academic Calendar', MARGIN + 2, 9, { charSpace: 0.5 })
  doc.text(settings.academicYear || '2026-2027', PAGE_W - MARGIN - 4, 9, { align: 'right' })
  doc.setGState(doc.GState({ opacity: 1.0 }))

  // Draft watermark
  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 2
  ACADEMIC_MONTHS.forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + col * (MONTH_W + 2)
    const y = startY + row * (MONTH_H + 3)
    const hdrColor = PALETTE[idx % PALETTE.length]
    const [hcr, hcg, hcb] = hexToRgbLocal(hdrColor)
    // Month header — full bold color fill
    doc.setFillColor(hcr, hcg, hcb); doc.roundedRect(x, y, MONTH_W, 9, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont(titleFont, 'bold')
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    doc.text(`${mName} ${year}`, x + MONTH_W / 2, y + 6, { align: 'center' })
    // Day headers row
    const cellW = MONTH_W / 7; const headY = y + 12
    DAYS.forEach((d, i) => {
      if (i === 6) { doc.setFillColor(hcr, hcg, hcb); doc.setGState(doc.GState({ opacity: 0.15 })); doc.rect(x + i * cellW, headY - 2.5, cellW, 5, 'F'); doc.setGState(doc.GState({ opacity: 1.0 })) }
      doc.setTextColor(i === 6 ? hcr : 80, i === 6 ? hcg : 80, i === 6 ? hcb : 80)
      doc.setFontSize(4); doc.setFont('helvetica', 'bold')
      doc.text(i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d, x + i * cellW + cellW / 2, headY, { align: 'center' })
    })
    doc.setDrawColor(hcr, hcg, hcb); doc.setLineWidth(0.5); doc.line(x, headY + 1, x + MONTH_W, headY + 1)
    // Days
    const daysInMonth = getDaysInMonth(year, month)
    const firstDow = getFirstDayOfWeek(year, month)
    const cellH = (MONTH_H - 14) / 5
    for (let day = 1; day <= daysInMonth; day++) {
      const slot = day + firstDow - 1
      const dc = slot % 7; const dr = Math.floor(slot / 7)
      const cx = x + dc * cellW; const cy = y + 13.5 + dr * cellH
      const dk = formatDateKey(new Date(year, month, day))
      const dayEvs = (events[dk] || []).filter(e => e.category !== 'rosh-chodesh')
      if (dayEvs.length > 0) {
        const cat = categories.find(c => c.id === dayEvs[0].category)
        const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#999')
        doc.setFillColor(er, eg, eb); doc.roundedRect(cx + 0.3, cy + 0.3, cellW - 0.6, cellH - 0.6, 0.5, 0.5, 'F')
        doc.setTextColor(255, 255, 255)
      } else if (dc === 6) {
        doc.setFillColor(hcr, hcg, hcb); doc.setGState(doc.GState({ opacity: 0.1 })); doc.rect(cx, cy, cellW, cellH, 'F'); doc.setGState(doc.GState({ opacity: 1.0 }))
        doc.setTextColor(hcr, hcg, hcb)
      } else { doc.setTextColor(50, 50, 60) }
      doc.setFontSize(4.5); doc.setFont('helvetica', dayEvs.length > 0 ? 'bold' : 'normal')
      doc.text(String(day), cx + 1, cy + 3.5)
    }
  })
  // Sidebar
  const sbX = PAGE_W - MARGIN - SIDEBAR_W
  doc.setFillColor(252, 252, 255); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, PAGE_H - HEADER_H - MARGIN - 2, 'F')
  doc.setFillColor(pr, pg, pb); doc.rect(sbX, HEADER_H + 2, SIDEBAR_W, 8, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont(titleFont, 'bold')
  doc.text('LEGEND', sbX + SIDEBAR_W / 2, HEADER_H + 8, { align: 'center' })
  let legY = HEADER_H + 16
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb); doc.roundedRect(sbX + 4, legY - 2.5, 5, 4, 0.5, 0.5, 'F')
    doc.setTextColor(40, 40, 50); doc.setFontSize(5); doc.setFont('helvetica', 'normal')
    doc.text(cat.name, sbX + 11, legY, { maxWidth: SIDEBAR_W - 14 })
    legY += 7
  })
  if (preview) return doc.output('bloburl')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-BulletinBoard.pdf`)
}
