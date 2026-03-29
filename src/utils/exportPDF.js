import { jsPDF } from 'jspdf'
import { loadMontserrat } from './pdfFonts.js'
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
const HEADER_H = 18
const BOTTOM_PANEL_H = 38

function hexToRgb(hex) {
  const clean = (hex || '#999999').replace('#', '').padEnd(6, '9')
  const r = parseInt(clean.slice(0, 2), 16) || 153
  const g = parseInt(clean.slice(2, 4), 16) || 153
  const b = parseInt(clean.slice(4, 6), 16) || 153
  return [r, g, b]
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

function drawMonth(doc, { year, month }, events, categories, settings, x, y, w, h, shabbatLabel) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })
  const isFilled = settings.cellStyle === 'filled'

  // Month header — taller with larger text
  doc.setFillColor(30, 58, 95)
  doc.roundedRect(x, y, w, 8, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
  const hebrewLabel = getHebrewMonthLabel(year, month)
  doc.text(monthName, x + 1.5, y + 3.8)
  // Measure width at the same 7pt bold before switching style
  const monthNameW = doc.getTextWidth(monthName)
  // Year in gold — consistent 1mm gap after month name
  doc.setTextColor(212, 175, 55)
  doc.setFontSize(6.5)
  doc.text(` ${String(year)}`, x + 1.5 + monthNameW, y + 3.8)
  // Hebrew sub-label
  doc.setTextColor(180, 210, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4)
  doc.text(hebrewLabel, x + 1.5, y + 6.5, { maxWidth: w - 3 })

  // Day header row
  const dayLabelY = y + 9.5
  const cellW = w / 7
  DAYS.forEach((d, i) => {
    const labelStr = i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d
    if (i === 6) {
      doc.setFillColor(210, 220, 236)  // same light tone as Shabbos cell shading
      doc.rect(x + i * cellW, dayLabelY - 2, cellW, 3, 'F')
    }
    doc.setTextColor(i === 6 ? 30 : 80, i === 6 ? 58 : 80, i === 6 ? 95 : 80)
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

    // Shabbat background — always apply light navy tint first, event fill paints over if needed
    if (dow === 6) {
      doc.setFillColor(225, 232, 242)
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

function drawBottomEventsPanel(doc, events, categories, y, pageW, margin, sidebarW) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const panelY = y
  const panelW = pageW - margin * 2 - sidebarW - 2

  // Panel background
  doc.setFillColor(15, 45, 61)
  doc.roundedRect(margin, panelY, panelW, BOTTOM_PANEL_H, 2, 2, 'F')

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
    doc.setFont('helvetica', 'normal')
    Object.values(monthEvs).sort((a, b) => a.dates[0].localeCompare(b.dates[0])).slice(0, 5).forEach(({ ev, dates }) => {
      const cat = catMap[ev.category]
      const color = ev.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.circle(colX + 1.2, evY - 0.5, 0.7, 'F')
      const groups = groupConsecutiveDates([...dates].sort())
      const rangeStr = groups.map(g => formatRangeLabel(g)).join(', ')
      // Split label to know how many lines it wraps to
      doc.setFontSize(3)
      const fullText = `${rangeStr} ${ev.label}`
      const labelLines = doc.splitTextToSize(fullText, colW - 3.5)
      doc.setTextColor(200, 220, 240)
      doc.text(labelLines, colX + 2.5, evY)
      // Line height at 3pt ≈ 1.2mm; extra lines push the sub-label down
      const extraLinesMM = (labelLines.length - 1) * 1.2
      const catName = cat?.name || ''
      if (catName) {
        doc.setFontSize(2.6)
        doc.setTextColor(160, 185, 210)
        doc.text(catName, colX + 2.5, evY + 1.7 + extraLinesMM, { maxWidth: colW - 3.5 })
        evY += 1.7 + extraLinesMM
      }
      evY += 3.2
    })
  })
}

export async function exportPDF(state, { preview = false } = {}) {
  const { events, categories, schoolInfo, settings } = state
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const hasMontserrat = await loadMontserrat(doc)
  const titleFont = hasMontserrat ? 'Montserrat' : 'helvetica'
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'
  const showBottomPanel = settings.eventsPanel === 'bottom'

  // Layout measurements
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W
  const MONTH_W = (GRID_W / COL_COUNT) - 2
  const MONTH_ROWS = 3
  const availH = showBottomPanel
    ? PAGE_H - (HEADER_H + 2) - MARGIN - BOTTOM_PANEL_H - 4
    : PAGE_H - (HEADER_H + 2) - MARGIN - 2
  const MONTH_H = availH / MONTH_ROWS - 3

  // ── Header ──────────────────────────────────────────
  // Left dark navy band (~60% width)
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, PAGE_W * 0.62, HEADER_H, 'F')
  // Right slightly lighter blue band (~40% width)
  doc.setFillColor(42, 74, 120)
  doc.rect(PAGE_W * 0.62, 0, PAGE_W * 0.38, HEADER_H, 'F')
  // Gold accent bar along the bottom of the header
  doc.setFillColor(212, 175, 55)
  doc.rect(0, HEADER_H - 1.5, PAGE_W, 1.5, 'F')

  // Logo — circular crop via canvas
  if (schoolInfo.logo) {
    try {
      const circularLogo = await circularCropImage(schoolInfo.logo)
      doc.addImage(circularLogo, 'PNG', MARGIN, 2, 13, 13)
    } catch {}
  }

  // Gold left accent bar before logo
  doc.setFillColor(212, 175, 55)
  doc.rect(0, 0, 3, HEADER_H - 1.5, 'F')

  // School name — GOLD, prominent
  doc.setTextColor(212, 175, 55)
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
    doc.setFontSize(60)
    doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.08 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1 }))
  }

  // ── Calendar Grid ──────────────────────────────────
  const startY = HEADER_H + 2

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
    drawBottomEventsPanel(doc, events, categories, panelTop, PAGE_W, MARGIN, SIDEBAR_W)
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
  doc.setFillColor(30, 58, 95)
  doc.rect(sbX, sbTop, SIDEBAR_W, titleStripH, 'F')
  // Gold accent bar along bottom of strip
  doc.setFillColor(212, 175, 55)
  doc.rect(sbX, sbTop + titleStripH - 2, SIDEBAR_W, 2, 'F')
  // "YAYOE" — large bold white, centered
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont(titleFont, 'bold')
  doc.text('YAYOE', sbCx, sbTop + 12, { align: 'center' })
  // Thin gold decorative rule below YAYOE
  doc.setDrawColor(212, 175, 55)
  doc.setLineWidth(0.4)
  const stripRuleW = SIDEBAR_W * 0.6
  doc.line(sbCx - stripRuleW / 2, sbTop + 15, sbCx + stripRuleW / 2, sbTop + 15)
  // "Academic Year" label — gold, centered
  doc.setTextColor(212, 175, 55)
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
  doc.setTextColor(30, 58, 95)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('SCHOOL HOURS', sbCx, hoursY, { align: 'center' })
  // Gold underline rule
  const ruleW = SIDEBAR_W * 0.78
  doc.setDrawColor(212, 175, 55)
  doc.setLineWidth(0.5)
  doc.line(sbCx - ruleW / 2, hoursY + 1.8, sbCx + ruleW / 2, hoursY + 1.8)

  const hourLines = (schoolInfo.hours || 'Boys: 8:30 AM – 4:30 PM\nGirls: 8:30 AM – 3:30 PM\nFriday: 8:30 AM – 1:30 PM').split('\n')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(50, 60, 80)
  hourLines.forEach((line, i) => {
    doc.text(line.trim(), sbCx, hoursY + 7 + i * 5.5, { align: 'center' })
  })

  // ── Full-width gold divider ──
  const midDivY = hoursY + 7 + hourLines.length * 5.5 + 4
  doc.setDrawColor(212, 175, 55)
  doc.setLineWidth(0.5)
  doc.line(sbX + 3, midDivY, sbX + SIDEBAR_W - 3, midDivY)

  // ── LEGEND section ──
  const legendHeadY = midDivY + 6
  doc.setTextColor(30, 58, 95)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('LEGEND', sbCx, legendHeadY, { align: 'center' })
  // Gold underline rule
  doc.setDrawColor(212, 175, 55)
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
  doc.setDrawColor(212, 175, 55)
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
  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}.pdf`)
}
