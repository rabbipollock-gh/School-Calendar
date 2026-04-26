import { jsPDF } from 'jspdf'
import { loadMontserrat } from './pdfFonts.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel, formatRangeGroups } from './dateUtils.js'

import { getAcademicMonths } from './academicMonths.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'
import { getRoshChodeshMap, getHolidayMap, getHebrewDayNumber } from '../data/hebrewCalendar.js'
import { getTheme, hexToRgb } from './themeUtils.js'
import { recordExport } from './sessionMetrics.js'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SHA']
const COL_COUNT = 4
const PAGE_W = 279.4  // US Letter landscape mm
const PAGE_H = 215.9
const MARGIN = 5
const SIDEBAR_W = 46
const HEADER_H = 14

function hexToRgbLocal(hex) {
  return hexToRgb(hex)
}

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

// Canonical category colors — consistent across events panel and footer legend.
// Falls back to the category's own stored color for custom/unknown categories.
const CAT_COLORS = {
  'no-school':       '#D05050',
  'early-dismissal': '#E89A2C',
  'chanukah':        '#E89A2C',
  'school-event':    '#2F7DD1',
  'staff':           '#8E56B8',
  'hebrew-only':     '#2FA38A',
}
function catColor(categoryId, fallback) {
  return fallback || CAT_COLORS[categoryId] || '#999999'
}

// Render an emoji character to a PNG data URL via canvas (workaround for jsPDF font limits)
function renderEmojiToImage(emoji, size = 40) {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, size, size)
      ctx.font = `${Math.round(size * 0.78)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(emoji, size / 2, size / 2 + 1)
      resolve(canvas.toDataURL('image/png'))
    } catch { resolve(null) }
  })
}

// Converts "13:30" → "1:30pm", "09:00" → "9am"
function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

// Extracts "HH:MM" from a category name like "Chanukah 3:45 Dismissal" → "15:45"
// Hours 1–7 are assumed PM (school dismissal context); 8–11 assumed AM; 12+ kept as-is.
function parseCategoryTime(name) {
  const m = (name || '').match(/\b(\d{1,2}):(\d{2})\b/)
  if (!m) return null
  const h = parseInt(m[1])
  const h24 = (h >= 1 && h <= 7) ? h + 12 : h
  return `${String(h24).padStart(2, '0')}:${m[2]}`
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
      // Large, highly readable hours — this is daily reference info
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(tr, tg, tb)
      hourLines.forEach((line, i) => doc.text(line.trim(), sbCx, y + 8 + i * 7, { align: 'center', maxWidth: SIDEBAR_W - 4 }))
      y += 8 + hourLines.length * 7 + 4
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbX + 3, y, sbX + SIDEBAR_W - 3, y)
      return y + 5
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
        const itemY = y + idx * 7.5
        // Large bold swatch — 3× bigger, matches actual calendar cell colors
        doc.setFillColor(r, g, b); doc.roundedRect(sbX + 3, itemY - 3.5, 8, 5.5, 0.5, 0.5, 'F')
        doc.setTextColor(tr, tg, tb); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold')
        doc.text(cat.name, sbX + 13, itemY, { maxWidth: SIDEBAR_W - 15 })
      })
      y += visibleCats.length * 7.5 + 4
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbX + 3, y, sbX + SIDEBAR_W - 3, y)
      return y + 5
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
        // Fill white INSIDE clip so transparent logo pixels show white, not gray
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
      } else if (shape === 'rounded') {
        const r = size * 0.15
        ctx.beginPath()
        ctx.moveTo(r, 0); ctx.lineTo(size - r, 0); ctx.arcTo(size, 0, size, r, r)
        ctx.lineTo(size, size - r); ctx.arcTo(size, size, size - r, size, r)
        ctx.lineTo(r, size); ctx.arcTo(0, size, 0, size - r, r)
        ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r)
        ctx.closePath(); ctx.clip()
        // Fill white INSIDE clip
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
      }
      // 'square' — no clip, fill white before drawing to prevent black transparent pixels
      if (shape === 'square') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
      }
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

// Draws a decorative band: two thin rules with accent dots between them. Used by Orchid Elegance template.
function drawDecorativeDiamondBand(doc, bandY, pageW, primaryRgb, accentRgb, margin = 10) {
  const [pr, pg, pb] = primaryRgb
  const [ar, ag, ab] = accentRgb
  // Two thin horizontal rules
  doc.setDrawColor(pr, pg, pb)
  doc.setLineWidth(0.4)
  doc.line(margin, bandY - 1.5, pageW - margin, bandY - 1.5)
  doc.line(margin, bandY + 1.5, pageW - margin, bandY + 1.5)
  // Small accent dots along the center line, alternating primary/accent
  const spacing = 5
  let toggle = 0
  for (let x = margin + 2.5; x <= pageW - margin - 2.5; x += spacing) {
    if (toggle % 3 === 1) {
      doc.setFillColor(ar, ag, ab)
    } else {
      doc.setFillColor(pr, pg, pb)
    }
    doc.circle(x, bandY, 0.8, 'F')
    toggle++
  }
}

function drawMonth(doc, { year, month }, events, categories, settings, x, y, w, h, shabbatLabel, notesStripH, theme, emojiCache = {}, titleFont = 'helvetica', numWeeks = 6, notesRowH = 5.0) {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })
  const isFilled = settings.cellStyle === 'filled'
  const isCompact = settings.template === 'compact'
  const s = isCompact ? 0.82 : 1
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  // Medium grey for Shabbat — consistent weekly visual rhythm, theme-independent
  const SHABBAT_R = 192, SHABBAT_G = 192, SHABBAT_B = 198

  // ── Card backgrounds (drawn first so content renders on top) ─────────────
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  if (notesStripH > 0) {
    doc.setFillColor(250, 251, 253)  // #FAFBFD — events zone tint
    doc.rect(x, y + h - notesStripH, w, notesStripH, 'F')
  }

  // Month header — "October 2026  ·  חשון" (larger, bolder)
  const headerH = 6 * s
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(x, y, w, headerH, 1, 1, 'F')
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
  const hebrewLabel = getHebrewMonthLabel(year, month)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10 * s)    // was 7.5 — bolder month title
  doc.setFont('helvetica', 'bold')
  const engPart = `${monthName} ${String(year)}`
  doc.text(engPart, x + 1.5, y + 4.5 * s)
  const engW = doc.getTextWidth(engPart)
  doc.setTextColor(200, 212, 232)   // #C8D4E8
  doc.setFontSize(8 * s)            // was 7 — readable Hebrew label
  doc.setFont('helvetica', 'normal')
  doc.text(`  ·  ${hebrewLabel}`, x + 1.5 + engW, y + 4.5 * s, { maxWidth: w - 3 - engW - 1.5 })

  // Day header row — #F5F6F8 background strip; SHA keeps gray shading with dark bold text
  const dayLabelY = y + (isCompact ? 7 : 8)   // adjusted for taller month header
  const cellW = w / 7
  doc.setFillColor(245, 246, 248)   // #F5F6F8 strip for all columns
  doc.rect(x, dayLabelY - 2.5, w, 4 * s, 'F')
  DAYS.forEach((d, i) => {
    const labelStr = i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d
    const isShabbat = i === 6
    if (isShabbat) {
      doc.setFillColor(SHABBAT_R, SHABBAT_G, SHABBAT_B)
      doc.rect(x + i * cellW, dayLabelY - 2.5, cellW, 4 * s, 'F')
      doc.setTextColor(31, 45, 74)    // #1F2D4A — bold SHA emphasis
    } else {
      doc.setTextColor(107, 122, 148) // #6B7A94
    }
    doc.setFontSize(5.5 * s)          // was 4.5 — more legible day labels
    doc.setFont('helvetica', 'bold')
    doc.text(labelStr, x + i * cellW + cellW / 2, dayLabelY, { align: 'center' })
  })

  // Day cells
  const days = getDaysInMonth(year, month)
  const startDow = getFirstDayOfWeek(year, month)
  const headerOffset = isCompact ? 9 : 10   // taller header (6mm) + day-label row
  const cellH = (h - headerOffset - (notesStripH || 0)) / numWeeks

  // ── Pre-pass: classify events by type for special rendering ──────────────
  const noSchoolMap = {}      // dateKey → { label }
  const earlyDismissMap = {}  // dateKey → { label, time, color }
  days.forEach(date => {
    const dateKey = formatDateKey(date)
    ;(events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
      const cat = catMap[ev.category]
      const cname = cat?.name?.toLowerCase() || ''
      if (ev.category === 'no-school' || cname.includes('no school')) {
        noSchoolMap[dateKey] = { label: ev.label }
      }
      if (ev.category === 'early-dismissal' || cname.includes('dismissal')) {
        earlyDismissMap[dateKey] = { label: ev.label, time: ev.time || parseCategoryTime(cat?.name), color: ev.color || cat?.color || '#D68910' }
      }
    })
  })

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
    const isNoSchool = !!noSchoolMap[dateKey]
    const isEarlyDismiss = !!earlyDismissMap[dateKey]

    // Shabbat background — medium grey regardless of theme
    if (dow === 6) {
      doc.setFillColor(SHABBAT_R, SHABBAT_G, SHABBAT_B)
      doc.rect(cx, cy, cellW, cellH, 'F')
    }

    // Date number baseline: fixed 2.8mm from cell top, but capped proportionally so small
    // cells (6-week months) don't push the number to the very bottom edge.
    const dateNumY = Math.min(cy + 2.8 * s, cy + cellH * 0.60)

    if (isNoSchool) {
      doc.setFillColor(208, 80, 80)  // #D05050 — no-school red
      doc.roundedRect(cx + 0.15, cy + 0.15, cellW - 0.3, cellH - 0.3, 0.5, 0.5, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(5.5 * s)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, dateNumY)
      doc.setFont('helvetica', 'normal')
    } else if (isEarlyDismiss) {
      // ── Early dismissal: amber fill + date number + dismissal time ──
      const ed = earlyDismissMap[dateKey]
      const [r, g, b] = hexToRgbLocal(ed.color)
      doc.setFillColor(r, g, b)
      doc.roundedRect(cx + 0.15, cy + 0.15, cellW - 0.3, cellH - 0.3, 0.5, 0.5, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(5.5 * s)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, dateNumY)
      if (ed.time && dateNumY + 3.5 < cy + cellH) {
        doc.setFontSize(3.2 * s)
        doc.setFont('helvetica', 'normal')
        doc.text(formatTime(ed.time), cx + 0.8, dateNumY + 3.5, { maxWidth: cellW - 1.2 })
      }
    } else if (isFilled && dayEvs.length > 0) {
      // Filled cell mode for other events
      const firstEv = dayEvs[0]
      const cat = catMap[firstEv.category]
      const color = firstEv.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      doc.setFillColor(r, g, b)
      doc.roundedRect(cx + 0.2, cy + 0.2, cellW - 0.4, cellH - 0.4, 0.5, 0.5, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(5.5 * s)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, dateNumY)
      if (firstEv.label && dateNumY + 3.5 * s < cy + cellH) {
        doc.setFontSize(3.5 * s)
        doc.setFont('helvetica', 'normal')
        const lbl = firstEv.label.length > 12 ? firstEv.label.slice(0, 11) + '…' : firstEv.label
        doc.text(lbl, cx + 0.8, dateNumY + 3.5 * s, { maxWidth: cellW - 1.2 })
      }
      doc.setFont('helvetica', 'normal')
    } else {
      // Dot mode — day number + colored dot + tiny label
      doc.setTextColor(31, 45, 74)   // #1F2D4A
      doc.setFontSize(5.5 * s)
      doc.text(String(dayNum), cx + 0.8, dateNumY)
      dayEvs.slice(0, 2).forEach((ev, evIdx) => {
        const cat = catMap[ev.category]
        const color = ev.color || cat?.color || '#999999'
        const [r, g, b] = hexToRgb(color)
        const dotY = dateNumY + 1.8 * s + evIdx * 2.8 * s
        if (dotY + 0.9 * s > cy + cellH) return   // circle would overflow cell bottom — skip
        doc.setFillColor(r, g, b)
        doc.circle(cx + 1.2, dotY, 0.9 * s, 'F')
        if (ev.label && cellW > 8 && dotY + 1.5 < cy + cellH) {
          doc.setFontSize(3.5 * s)
          doc.setTextColor(r, g, b)
          const lbl = ev.label.length > 11 ? ev.label.slice(0, 10) + '…' : ev.label
          doc.text(lbl, cx + 3, dotY + 0.6, { maxWidth: cellW - 3.5 })
        }
      })
    }

    // Cell border — 0.5pt #E1E4EA
    doc.setDrawColor(225, 228, 234)
    doc.setLineWidth(0.18)
    doc.rect(cx, cy, cellW, cellH, 'S')

    // Rosh Chodesh label — top-center of cell, 1pt top padding, never shifts date number.
    if (rcMonth) {
      const RC_ABBREV = {
        'Tishrei':'Tish.','Cheshvan':'Ches.','Kislev':'Kis.','Tevet':'Tevet',
        'Shvat':'Shvat','Adar':'Adar','Adar I':'Ad.I','Adar II':'Ad.II',
        'Nisan':'Nisan','Iyar':'Iyar','Sivan':'Sivan','Tamuz':'Tamuz',
        'Av':'Av','Elul':'Elul',
      }
      const rcShort = RC_ABBREV[rcMonth] || rcMonth.slice(0, 6)
      let rcText = `R.Ch. ${rcShort}`
      const maxRcW = cellW - 0.4
      // Max safe font: date number is at cy+2.8mm, its cap-top ≈ cy+1.4mm.
      // RC baseline must stay ≤ cy+1.4mm → 3.5pt gives baseline at cy+1.1mm (0.3mm clearance).
      doc.setFont('helvetica', 'italic')
      let rcFontPt = 3.5 * s
      doc.setFontSize(rcFontPt)
      if (doc.getTextWidth(rcText) > maxRcW) {
        rcFontPt = 3 * s
        doc.setFontSize(rcFontPt)
      }
      while (rcText.length > 5 && doc.getTextWidth(rcText) > maxRcW) {
        rcText = rcText.slice(0, -1)
      }
      // Baseline: 0.2mm top padding + cap-height (≈ 72% of font size in mm)
      const rcY = cy + 0.2 + rcFontPt * 0.3528 * 0.72
      doc.setTextColor(74, 90, 122)   // #4A5A7A
      doc.text(rcText, cx + cellW / 2, rcY, { align: 'center' })
      doc.setFont('helvetica', 'normal')
    }
    // Hebrew holiday — emoji icon image (small, bottom-right of cell)
    if (hebrewHoliday && settings.hebrewHolidayToggles?.[hebrewHoliday.group] !== false) {
      const customIcons = settings.hebrewHolidayIcons || {}
      const icon = customIcons[hebrewHoliday.group] || hebrewHoliday.icon
      const iconImg = emojiCache[icon]
      if (iconImg) {
        const iconSz = Math.min(cellW * 0.38, cellH * 0.42, 4.5)
        doc.addImage(iconImg, 'PNG', cx + cellW - iconSz - 0.3, cy + cellH - iconSz - 0.3, iconSz, iconSz)
      }
    }
  })

  // ── Notes strip (when eventsPanel === 'inline') ───────────────────────────
  if (settings.eventsPanel !== 'bottom' && notesStripH > 0) {
    const stripH = notesStripH
    const notesY = y + h - stripH

    const allEventRanges = {}
    Object.entries(events).forEach(([dk, dayEvs]) => {
      ;(dayEvs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        if (!allEventRanges[key]) allEventRanges[key] = []
        allEventRanges[key].push(dk)
      })
    })
    const allEventRunGroups = {}
    Object.entries(allEventRanges).forEach(([key, dates]) => {
      allEventRunGroups[key] = groupConsecutiveDates([...dates].sort())
    })

    const notesEvents = {}
    days.forEach(date => {
      const dateKey = formatDateKey(date)
      ;(events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        const runGroups = allEventRunGroups[key] || [[dateKey]]
        const groupIdx = runGroups.findIndex(g => g.includes(dateKey))
        const idx = groupIdx >= 0 ? groupIdx : 0
        const entryKey = runGroups.length > 1 ? `${key}::r${idx}` : key
        if (!notesEvents[entryKey]) {
          notesEvents[entryKey] = { ev, dates: runGroups[idx] || [dateKey] }
        }
      })
    })

    const maxNoteY = y + h - 0.5
    let noteLineY = notesY + 4
    const ROW_H    = notesRowH
    const BAR_W    = 1.06  // mm = 3pt
    const LEFT_PAD = 2.0   // mm from card left edge to accent bar
    const TEXT_X   = x + LEFT_PAD + BAR_W + 2.8  // 8pt right of bar
    const DATE_X   = x + w - 2.5                  // right-align anchor
    const BASE_OFF = 3.4   // baseline offset from row top (mm)
    const entries = Object.values(notesEvents)
    entries.forEach(({ ev, dates }, entryIdx) => {
      if (noteLineY + ROW_H > maxNoteY + 0.5) return
      const cat = catMap[ev.category]
      const rawColor = ev.color || cat?.color || '#999999'
      const isNoSchool = ev.category === 'no-school'
      const barHex = isNoSchool ? '#D05050' : catColor(ev.category, rawColor)
      const [br, bg_c, bb] = hexToRgb(barHex)

      // Strip bare parenthetical times from label: "(1:30)", "(9am)", "(11:30pm)"
      // Mixed content like "(9AM Start)" is left as-is (TODO: ask user about semantics)
      const cleanLabel = ev.label.replace(/\s*\(\d{1,2}(?::\d{2})?\s*(?:[ap]m|AM|PM)?\)/gi, '').trim()

      // Accent bar — 3pt wide, full row height
      doc.setFillColor(br, bg_c, bb)
      doc.rect(x + LEFT_PAD, noteLineY, BAR_W, ROW_H, 'F')

      // Date string: "MMM D–MMM D" for cross-month runs, plain day numbers otherwise.
      // isContinuation: true only when THIS run group started in a prior month.
      const sortedDates = [...dates].sort()
      const [fY, fM, fD] = sortedDates[0].split('-').map(Number)
      const lastParts = sortedDates[sortedDates.length - 1].split('-').map(Number)
      const [lM, lD] = [lastParts[1], lastParts[2]]
      const crossesMonths = fM !== lM || fY !== lastParts[0]
      const isContinuation = fY < year || (fY === year && fM < month + 1)

      const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      let shortDateStr
      if (crossesMonths) {
        shortDateStr = `${SHORT_MONTHS[fM-1]} ${fD}–${SHORT_MONTHS[lM-1]} ${lD}`
      } else {
        const groups = groupConsecutiveDates(sortedDates)
        shortDateStr = groups.map(g => {
          if (!g || g.length === 0) return ''
          const startDay = parseInt(g[0].split('-')[2], 10)
          const endDay = parseInt(g[g.length - 1].split('-')[2], 10)
          return g.length === 1 ? String(startDay) : `${startDay}–${endDay}`
        }).filter(Boolean).join(', ')
      }

      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      const shortDateW = doc.getTextWidth(shortDateStr)
      const EVENT_X = TEXT_X + shortDateW + 2.5

      const regTime = ev.regularDismissal && settings?.regularDismissalTime ? settings.regularDismissalTime : null
      const effectiveTime = ev.time || regTime || parseCategoryTime(cat?.name)
      const timeStr = effectiveTime ? ` ${formatTime(effectiveTime)}` : ''
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic')
      const timeW = timeStr ? doc.getTextWidth(timeStr) : 0
      const contStr = isContinuation ? ' (cont.)' : ''
      const contW = isContinuation ? doc.getTextWidth(contStr) : 0

      doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      const availNameW = Math.max(DATE_X - EVENT_X - timeW - contW, 12)
      const displayLabel = doc.splitTextToSize(cleanLabel, availNameW)[0] || cleanLabel
      const nameW = doc.getTextWidth(displayLabel)

      // Date — day number(s), left side, muted blue-gray
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.setTextColor(74, 90, 122)
      doc.text(shortDateStr, TEXT_X, noteLineY + BASE_OFF)

      // Event name — bold 9pt #1F2D4A, after date column
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 45, 74)
      doc.text(displayLabel, EVENT_X, noteLineY + BASE_OFF)

      // Inline time — italic 8.5pt #5A6A82, follows event name
      if (timeStr) {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'italic')
        doc.setTextColor(90, 106, 130)
        doc.text(timeStr, EVENT_X + nameW, noteLineY + BASE_OFF)
      }

      // (cont.) suffix — italic 8.5pt #5A6A82, follows time if present
      if (isContinuation) {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'italic')
        doc.setTextColor(90, 106, 130)
        doc.text(contStr, EVENT_X + nameW + timeW, noteLineY + BASE_OFF)
      }

      // Hairline separator — 0.25pt #EEF0F3, indented from bar; skip last row
      if (entryIdx < entries.length - 1) {
        doc.setDrawColor(238, 240, 243)
        doc.setLineWidth(0.25)
        doc.line(TEXT_X - 0.5, noteLineY + ROW_H, DATE_X, noteLineY + ROW_H)
      }

      noteLineY += ROW_H
    })
  }

  // ── Card border + grid/notes divider (drawn last — sits on top of all content) ──
  doc.setDrawColor(216, 220, 227)  // #D8DCE3
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 2, 2, 'S')
  if (notesStripH > 0) {
    const divY = y + h - notesStripH
    doc.setDrawColor(225, 228, 234)  // #E1E4EA
    doc.setLineWidth(0.5)
    doc.line(x + 1, divY, x + w - 1, divY)
  }
}

// ── Bottom events panel — measurement-based layout ───────────────────────────
// All sizing is derived from actual jsPDF text measurements so wrapping and
// vertical packing are always consistent.

const BP_HDR_H      = 10   // mm: month header block (label + gold accent line)
const BP_OVERHEAD   = 14   // mm: panel title bar + top padding
const BP_BOTTOM_PAD =  6   // mm: minimum bottom margin inside panel

// Default render params — the shrink loop may reduce these when content is tall
const BP_DEFAULT_PARAMS = {
  nameFontSz:   8,    // pt — event name
  dateFontSz:   7,    // pt — date/time line
  nameLineH:    3.5,  // mm — line-advance for each name line (≈8pt × 0.44)
  padTop:       0.5,  // mm — above first name baseline
  dateGap:      3.2,  // mm — from last name baseline down to date baseline
  rowBottomPad: 1.3,  // mm — below date baseline to row bottom
  sepH:         5.0,  // mm — gap between month groups in same column
}

// Height of one event row given its line count and params
function bpRowH(lineCount, p) {
  return p.padTop + lineCount * p.nameLineH + p.dateGap + p.rowBottomPad
}

// Scan events into raw (unmeasured) month groups
function bpRawGroups(events, academicYear) {
  return getAcademicMonths(academicYear).map(({ year, month }, mi) => {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const monthEvs = {}
    Object.entries(events).forEach(([dk, evs]) => {
      if (!dk.startsWith(monthKey)) return
      ;(evs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        if (!monthEvs[key]) monthEvs[key] = { ev, dates: [] }
        monthEvs[key].dates.push(dk)
      })
    })
    const evItems = Object.values(monthEvs).sort((a, b) => a.dates[0].localeCompare(b.dates[0]))
    return { mi, year, month, evItems }
  })
}

// Measure each event row (wrapping) and compute group heights.
// availW is the usable text width inside a column.
function bpMeasureGroups(doc, rawGroups, availW, p) {
  return rawGroups.map(g => {
    const evItems = g.evItems.map(({ ev, dates }) => {
      doc.setFontSize(p.nameFontSz)
      doc.setFont('helvetica', 'bold')
      const lines = doc.splitTextToSize(ev.label, availW)
      return { ev, dates, lines, rowH: bpRowH(lines.length, p) }
    })
    // Empty groups reserve 6mm for the "No events" placeholder line
    const groupH = BP_HDR_H + (evItems.length === 0 ? 6 : evItems.reduce((s, it) => s + it.rowH, 0))
    return { ...g, evItems, groupH }
  })
}

// Ordered partition (DP): split groups (already in chronological order) into numCols
// consecutive groups minimising the maximum column height. Months stay in order:
// column 1 gets the earliest months, column N gets the latest.
function bpOrderedPack(groups, numCols, sepH) {
  const M = groups.length
  if (M === 0) return Array.from({ length: numCols }, () => ({ groups: [], usedH: 0 }))

  // Height of groups[start..end-1] stacked as a single column
  const colH = (start, end) => {
    let h = 0
    for (let i = start; i < end; i++) {
      if (i > start) h += sepH
      h += groups[i].groupH
    }
    return h
  }

  const dp       = Array.from({ length: numCols + 1 }, () => new Array(M).fill(Infinity))
  const splitAt  = Array.from({ length: numCols + 1 }, () => new Array(M).fill(0))

  // Base: 1 column = all groups[0..i] stacked
  for (let i = 0; i < M; i++) { dp[1][i] = colH(0, i + 1); splitAt[1][i] = 0 }

  for (let j = 2; j <= Math.min(numCols, M); j++) {
    for (let i = j - 1; i < M; i++) {
      for (let k = j - 2; k < i; k++) {
        const val = Math.max(dp[j - 1][k], colH(k + 1, i + 1))
        if (val < dp[j][i]) { dp[j][i] = val; splitAt[j][i] = k + 1 }
      }
    }
  }

  // Reconstruct columns (right-to-left)
  const cols   = Math.min(numCols, M)
  const result = []
  let remaining = M - 1
  let c = cols
  while (c > 0) {
    const start = c === 1 ? 0 : splitAt[c][remaining]
    const slice = groups.slice(start, remaining + 1)
    result.unshift({ groups: slice, usedH: colH(start, remaining + 1) })
    remaining = start - 1
    c--
  }
  // Pad with empty columns if numCols > M
  while (result.length < numCols) result.push({ groups: [], usedH: 0 })
  return result
}

// Full layout computation: measure → LPT-pack → shrink-if-needed → return layout.
// panelW is passed so measurement uses the real column width.
// maxPanelH is derived by the caller from page geometry so the footer never overlaps.
function bpComputeLayout(doc, events, academicYear, panelW, maxPanelH = 110, includeEmpty = false) {
  const MAX_PANEL_H = maxPanelH
  // By default skip months with no events; pass includeEmpty=true to show all months.
  const rawGroups = includeEmpty
    ? bpRawGroups(events, academicYear)
    : bpRawGroups(events, academicYear).filter(g => g.evItems.length > 0)
  if (rawGroups.length === 0) return { columns: [], params: BP_DEFAULT_PARAMS, panelH: 0, panelW }
  let numCols = Math.min(rawGroups.length, 8)
  let p = { ...BP_DEFAULT_PARAMS }

  // Shrink steps applied in order when tallest column exceeds available height
  const shrinks = [
    q => ({ ...q, padTop: 0.3, rowBottomPad: 0.9 }),        // tighter row padding
    q => ({ ...q, sepH: 3.5 }),                               // reduce inter-month gap
    q => ({ ...q, nameFontSz: 7.5, nameLineH: 3.3 }),         // smaller name font
    q => ({ ...q, sepH: 2.5 }),                               // tighten gap further
    q => ({ ...q, dateGap: 2.8 }),                            // tighter date spacing
    q => ({ ...q, nameFontSz: 7, nameLineH: 3.1 }),           // smallest name font
    // column-count increases handled below
  ]
  let shrinkIdx = 0

  const tryLayout = () => {
    const colW   = panelW / numCols
    const availW = Math.max(6, colW - 6.1)   // colW minus bar(1.06)+left pad(3)+right pad(2)+margin
    const measured = bpMeasureGroups(doc, rawGroups, availW, p)
    const packed   = bpOrderedPack(measured, numCols, p.sepH)
    const tallestH = Math.max(...packed.map(c => c.usedH), 0)
    const panelH   = Math.min(MAX_PANEL_H, Math.max(38, tallestH + BP_OVERHEAD + BP_BOTTOM_PAD))
    const avail    = panelH - BP_OVERHEAD - BP_BOTTOM_PAD
    return { packed, tallestH, panelH, avail }
  }

  let { packed, tallestH, panelH, avail } = tryLayout()

  // Only shrink font/spacing — never increase numCols beyond the initial value.
  // Increasing numCols narrows columns which causes more label wrapping and a
  // feedback loop that makes groupH *larger*, spiralling until months overflow.
  while (tallestH > avail && shrinkIdx < shrinks.length) {
    p = shrinks[shrinkIdx++](p)
    ;({ packed, tallestH, panelH, avail } = tryLayout())
  }

  if (tallestH > avail) {
    console.warn(`[PDF] events panel: tallestH ${tallestH.toFixed(1)} > avail ${avail.toFixed(1)} — some events may clip`)
  }

  return {
    columns: packed.map(c => c.groups),
    params:  p,
    panelH,
    panelW,
  }
}

// Render the bottom events panel using a pre-computed layout from bpComputeLayout().
// opts: { titleColor, colBorderColor, colBorderWidth, colBorderAll }
function drawBottomEventsPanel(doc, categories, y, pageW, margin, sidebarW, layout, settings, opts = {}) {
  const MONTH_ABBR = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const { columns, params: p, panelH, panelW } = layout
  const panelY       = y
  const contentBound = panelY + panelH - BP_BOTTOM_PAD   // hard lower boundary for all content

  const titleRgb     = opts.titleColor      || [232, 182, 76]
  const colBdrRgb    = opts.colBorderColor  || [45, 65, 95]
  const colBdrW      = opts.colBorderWidth  != null ? opts.colBorderWidth : 0.25
  const colBdrAll    = !!opts.colBorderAll

  // Panel background — slightly lighter navy so accent colors read more vividly
  doc.setFillColor(26, 38, 64)   // #1A2640
  doc.roundedRect(margin, panelY, panelW, panelH, 2, 2, 'F')

  // Panel title — 10pt bold, uppercase
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...titleRgb)
  doc.text('EVENTS BY MONTH', margin + 4, panelY + 9)

  const colW = panelW / columns.length
  const COL_START_Y = panelY + BP_OVERHEAD

  columns.forEach((groups, ci) => {
    const colX = margin + ci * colW

    // Column separator / left border
    if (ci > 0 || colBdrAll) {
      doc.setDrawColor(...colBdrRgb)
      doc.setLineWidth(colBdrW)
      doc.line(colX, panelY + 3, colX, panelY + panelH - 3)
    }

    let drawY = COL_START_Y

    groups.forEach((group, gi) => {
      // Inter-group rule + gap (not before the first group in a column)
      if (gi > 0) {
        drawY += 1.5
        doc.setDrawColor(60, 85, 120)
        doc.setLineWidth(0.4)
        doc.line(colX + 1.5, drawY, colX + colW - 1.5, drawY)
        drawY += p.sepH - 1.5
      }

      // Skip only if there's not even room for the header
      if (drawY + BP_HDR_H > contentBound + 0.5) return

      // ── Month header ──────────────────────────────────────────────
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(`${MONTH_ABBR[group.mi]} '${String(group.year).slice(2)}`, colX + 3, drawY + 4.5)
      const accentW = Math.min(21, colW - 5)
      doc.setDrawColor(232, 182, 76)    // #E8B64C
      doc.setLineWidth(0.53)            // 1.5pt
      doc.line(colX + 3, drawY + 6, colX + 3 + accentW, drawY + 6)
      drawY += BP_HDR_H

      // ── Empty month placeholder ───────────────────────────────────
      if (group.evItems.length === 0) {
        doc.setFontSize(p.dateFontSz)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(110, 130, 165)
        doc.text('No events', colX + 4, drawY + 3.5)
        drawY += 6
      }

      // ── Event rows — clip individually so the header always shows ─
      group.evItems.forEach(({ ev, dates, lines, rowH }) => {
        if (drawY + rowH > contentBound + 0.5) return

        const cat   = catMap[ev.category]
        const color = catColor(ev.category, ev.color || cat?.color)
        const [r, g, b] = hexToRgb(color)

        // Left accent bar — category color, full row height
        doc.setFillColor(r, g, b)
        doc.rect(colX + 1, drawY, 1.06, rowH, 'F')

        // Name — one or more wrapped lines, bold white
        doc.setFontSize(p.nameFontSz)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        const firstNameY = drawY + p.padTop + p.nameLineH
        lines.forEach((line, li) => {
          doc.text(line, colX + 4, firstNameY + li * p.nameLineH)
        })

        // Date line — below all name lines
        const lastNameY = firstNameY + (lines.length - 1) * p.nameLineH
        const dateY     = lastNameY + p.dateGap
        const dGroups   = groupConsecutiveDates([...dates].sort())
        const rangeText = formatRangeGroups(dGroups)
        const regTime   = ev.regularDismissal && settings?.regularDismissalTime ? settings.regularDismissalTime : null
        const effectiveTime = ev.time || regTime || parseCategoryTime(cat?.name)
        const timeStr   = effectiveTime ? ` ${formatTime(effectiveTime)}` : ''
        doc.setFontSize(p.dateFontSz)
        doc.setFont('helvetica', effectiveTime ? 'italic' : 'normal')
        doc.setTextColor(200, 212, 232)   // #C8D4E8
        doc.text(rangeText + timeStr, colX + 4, dateY)
        doc.setFont('helvetica', 'normal')

        drawY += rowH
      })
    })
  })
}

// Helper: draw a per-month inline notes strip at (x, y, w × h)
function drawNotesStrip(doc, events, catMap, x, y, w, h, year, month, { modernStyle = false, colorOverrides = null } = {}) {
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
  const topPad = modernStyle ? 2 : 0
  const lineSpacing = modernStyle ? 2.4 : 1.8
  let lineY = y + 2.5 + topPad
  const maxY = y + h - (modernStyle ? 2.0 : 0.5)
  doc.setFontSize(4); doc.setFont('helvetica', 'normal')
  for (const { ev, dates } of Object.values(notesEvents)) {
    if (lineY > maxY) break
    const cat = catMap[ev.category]
    const color = colorOverrides?.[cat?.id] || ev.color || cat?.color || '#999'
    const [r, g, b] = hexToRgbLocal(color)
    doc.setFillColor(r, g, b); doc.circle(x + 1, lineY - 0.5, 0.6, 'F')
    const groups = groupConsecutiveDates([...dates].sort())
    const rangeStr = formatRangeGroups(groups)
    if (modernStyle) {
      // Date range in muted gray, event label + time in darker bold for contrast
      doc.setFontSize(4)
      const dateStr = `${rangeStr}  `
      doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 150)
      doc.text(dateStr, x + 2.5, lineY)
      const dw = doc.getTextWidth(dateStr)
      const remainW = w - 3.5 - dw
      const catTimeStr = parseCategoryTime(cat?.name)
      const timeStr = ev.time || catTimeStr ? `  ${formatTime(ev.time || catTimeStr)}` : ''
      const fullLabel = `${ev.label}${timeStr}`
      const labelLines = doc.splitTextToSize(fullLabel, remainW)
      const displayLabel = labelLines.length > 1 ? labelLines[0].replace(/\s+\S*$/, '') + '…' : labelLines[0]
      doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 50)
      doc.text(displayLabel, x + 2.5 + dw, lineY, { maxWidth: remainW })
      lineY += lineSpacing + 0.6
    } else {
      const lineText = `${rangeStr} | ${ev.label}`
      const lines = doc.splitTextToSize(lineText, w - 3.5)
      doc.setTextColor(60, 60, 60)
      doc.text(lines, x + 2.5, lineY, { maxWidth: w - 3.5 })
      lineY += lines.length * lineSpacing + 0.6
    }
  }
}

export async function exportPDF(state, { preview = false, pdfStyle = 'classic', monthIndex = null, eventsPanel = null } = {}) {
  if (!preview) recordExport('PDF', pdfStyle)
  // Allow PDF preview modal to override the eventsPanel setting per-export
  const effectiveState = eventsPanel != null
    ? { ...state, settings: { ...state.settings, eventsPanel } }
    : state
  const { events, categories, schoolInfo, settings } = effectiveState
  const theme = getTheme(settings.theme, settings.customPrimary, settings.customAccent)
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  // Minimal and Year at a Glance draw at A4 dimensions (297×210mm); all others use Letter
  const isA4Style = pdfStyle === 'minimal' || pdfStyle === 'year-at-a-glance'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: isA4Style ? 'a4' : 'letter' })
  const hasMontserrat = await loadMontserrat(doc)
  const titleFont = hasMontserrat ? 'Montserrat' : 'helvetica'
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'
  const ctx = { preview, theme, doc, titleFont, shabbatLabel }

  // Route to the correct style renderer
  if (pdfStyle === 'minimal')           return exportMinimal(effectiveState, ctx)
  if (pdfStyle === 'portrait-monthly')  return exportMonthlyPortrait(effectiveState, { ...ctx, monthIndex })
  if (pdfStyle === 'year-at-a-glance')  return exportYearAtAGlance(effectiveState, ctx)
  if (pdfStyle === 'dark-elegant')      return exportDarkElegant(effectiveState, ctx)
  if (pdfStyle === 'bulletin-board')    return exportBulletinBoard(effectiveState, ctx)
  if (pdfStyle === 'parchment-scroll')  return exportParchmentScroll(state, { preview, monthIndex })
  if (pdfStyle === 'dual-heritage')     return exportDualHeritage(state, { preview, theme, doc, titleFont, shabbatLabel })
  if (pdfStyle === 'regal-triptych')    return exportRegalTriptych(state, { preview, theme, doc, titleFont, shabbatLabel })
  if (pdfStyle === 'photo-showcase')    return exportPhotoShowcase(state, { preview, monthIndex })
  if (pdfStyle === 'hebrew-date-focus') return exportHebrewDateFocus(state, { preview, theme, doc, titleFont, shabbatLabel })
  if (pdfStyle === 'elegant-feminine')  return exportElegantFeminine(state, { preview, monthIndex })
  if (pdfStyle === 'portrait-classic')  return exportPortraitClassic(state, { preview })
  if (pdfStyle === 'traditional')       return exportTraditional(effectiveState, ctx)
  // default: classic
  const isCompact = settings.template === 'compact'
  const showBottomPanel = settings.eventsPanel === 'bottom'

  // Layout measurements — full-width grid (sidebar moved to footer bar at page bottom)
  const CLASSIC_FOOTER_H = showBottomPanel ? 0 : 9
  const GRID_W = PAGE_W - MARGIN * 2
  const MONTH_W = (GRID_W / COL_COUNT) - 2
  const MONTH_ROWS = 3
  const ROW_GAP = 3
  const HEADER_OFFSET = isCompact ? 9 : 10   // matches drawMonth headerOffset

  // Derive the maximum safe panel height: the panel must leave enough room for the
  // month grid (with cells no shorter than MIN_CELL_H) and the fixed footer.
  // If the panel were taller, CELL_H would clamp to its minimum, the grid would
  // consume more vertical space than allocated, and the footer would end up inside
  // the events panel.
  // 2.5 mm cells are tight but still readable; lowering this allows the events panel
  // to be ~93 mm tall (avail ≈ 73 mm) which is enough for Sep's 7 events.
  const MIN_CELL_H   = 2.5
  const MIN_GRID_H   = MONTH_ROWS * MIN_CELL_H * 6 + (MONTH_ROWS - 1) * ROW_GAP + MONTH_ROWS * HEADER_OFFSET
  // Bottom-panel mode gets a slim contact footer below the events panel
  const BP_FOOTER_H  = showBottomPanel ? 9 : 0
  const TOTAL_AVAIL  = PAGE_H - (HEADER_H + 2) - MARGIN - CLASSIC_FOOTER_H - BP_FOOTER_H
  const maxSafePanelH = Math.max(38, Math.floor(TOTAL_AVAIL - MIN_GRID_H))

  // Compute bottom panel layout (measures text, LPT-packs, shrinks to fit maxSafePanelH).
  // Must happen after doc is created so jsPDF can measure text widths.
  const bpPanelW = PAGE_W - MARGIN * 2 - 2
  const bottomLayout = showBottomPanel ? bpComputeLayout(doc, events, settings.academicYear, bpPanelW, maxSafePanelH) : null
  const dynamicPanelH = bottomLayout ? bottomLayout.panelH : 0
  const availH = showBottomPanel
    ? PAGE_H - (HEADER_H + 2) - MARGIN - dynamicPanelH - CLASSIC_FOOTER_H - BP_FOOTER_H
    : PAGE_H - (HEADER_H + 2) - MARGIN - CLASSIC_FOOTER_H
  const allMonths = getAcademicMonths(settings.academicYear)
  // Per-row max events → per-row notes heights (uncapped — grows to fit each row's busiest month)
  // New row design: 5mm per event row + 8mm header padding (divider gap)
  const perRowNotesH = showBottomPanel
    ? Array(MONTH_ROWS).fill(0)
    : Array.from({ length: MONTH_ROWS }, (_, row) => {
        // Row-first layout: row `row` contains months at positions row*COL_COUNT … row*COL_COUNT+COL_COUNT-1
        const rowMonths = allMonths.filter((_, idx) => Math.floor(idx / COL_COUNT) === row)
        const counts = rowMonths.map(({ year, month }) => {
          const mk = `${year}-${String(month + 1).padStart(2, '0')}`
          const seen = new Set()
          Object.entries(events).forEach(([dk, evs]) => {
            if (!dk.startsWith(mk)) return
            ;(evs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => seen.add(`${ev.category}::${ev.label}`))
          })
          return seen.size
        })
        const maxEv = counts.length > 0 ? Math.max(...counts) : 0
        return maxEv > 0 ? Math.max(16, maxEv * 5 + 8) : 0
      })
  const totalNotesH = perRowNotesH.reduce((a, b) => a + b, 0)
  // Single CELL_H for all rows — fills all available space exactly (no compact shrink factor;
  // compact appearance is handled inside drawMonth via font scaling)
  const CELL_H = Math.max(MIN_CELL_H,
    (availH - (MONTH_ROWS - 1) * ROW_GAP - MONTH_ROWS * HEADER_OFFSET - totalNotesH) / (MONTH_ROWS * 6)
  )
  const perRowMonthH = perRowNotesH.map(nh => CELL_H * 6 + HEADER_OFFSET + nh)

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

  // Logo — circular crop, centered vertically in header; captured for footer reuse
  const LOGO_SIZE = 11
  const logoY = (HEADER_H - LOGO_SIZE) / 2   // vertically centered
  let classicCircularLogo = null
  if (schoolInfo.logo) {
    try {
      classicCircularLogo = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(classicCircularLogo, 'PNG', MARGIN, logoY, LOGO_SIZE, LOGO_SIZE)
    } catch {}
  }

  // Gold left accent bar before logo
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, 0, 3, HEADER_H - 1.5, 'F')

  // School name / custom title — centered vertically in header
  const titleX = MARGIN + LOGO_SIZE + 3
  const titleY = 2 + 4.5        // baseline for 18pt title (cap ~6.3mm, top at ~1.8mm from header edge)
  const yearLineY = titleY + 5  // baseline for 10pt subtitle line

  const displayTitle = settings.calendarTitle || schoolInfo.name || 'YAYOE Calendar'
  doc.setFontSize(18)            // was 12 — bolder, higher hierarchy
  doc.setFont(titleFont, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(displayTitle, titleX, titleY)

  // Secondary line: "Academic Year 2026–2027  •  5787"
  doc.setFontSize(10)            // was 7 — larger, more readable
  doc.setFont(titleFont, 'normal')
  doc.setTextColor(200, 212, 232)  // #C8D4E8 — softer than pure white, clear hierarchy
  const hebrewYear = settings.hebrewYear || ''
  const yearLine = settings.showHebrewYear !== false && hebrewYear
    ? `Academic Year  ${settings.academicYear || '2026–2027'}  •  ${hebrewYear}`
    : `Academic Year  ${settings.academicYear || '2026–2027'}`
  doc.text(yearLine, titleX, yearLineY)

  // ── Draft Watermark ──────────────────────────────────
  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50)
    doc.setFontSize(72)
    doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  // ── Pre-render holiday emoji icons to PNG (jsPDF can't render emoji in text) ──
  const holidayMap = getHolidayMap(settings.academicYear)
  const emojiCache = {}
  await Promise.all(
    [...new Set(Object.values(holidayMap).map(h => (settings.hebrewHolidayIcons || {})[h.group] || h.icon).filter(Boolean))].map(
      async icon => { emojiCache[icon] = await renderEmojiToImage(icon) }
    )
  )

  // ── Calendar Grid ──────────────────────────────────
  const startY = HEADER_H + 2

  // Precompute row Y positions (rows have variable heights)
  const rowStartY = Array.from({ length: MONTH_ROWS }, (_, row) => {
    let y = startY
    for (let r = 0; r < row; r++) y += perRowMonthH[r] + ROW_GAP
    return y
  })

  allMonths.forEach(({ year, month }, idx) => {
    // Row-first: fill each row left-to-right before moving down
    // Row 0: Aug Sep Oct Nov, Row 1: Dec Jan Feb Mar, Row 2: Apr May Jun
    const row = Math.floor(idx / COL_COUNT)
    const col = idx % COL_COUNT
    const mx = MARGIN + col * (MONTH_W + 2)
    const mw = MONTH_W
    const y = rowStartY[row]
    const monthH = perRowMonthH[row]
    const notesH = perRowNotesH[row]
    const numWeeks = Math.ceil((getFirstDayOfWeek(year, month) + getDaysInMonth(year, month).length) / 7)
    drawMonth(doc, { year, month }, events, categories, settings, mx, y, mw, monthH, shabbatLabel, notesH, theme, emojiCache, titleFont, numWeeks)
  })

  // ── Bottom Events Panel ──────────────────────────────
  if (showBottomPanel) {
    const panelTop = rowStartY[MONTH_ROWS - 1] + perRowMonthH[MONTH_ROWS - 1] + 2
    drawBottomEventsPanel(doc, categories, panelTop, PAGE_W, MARGIN, 0, bottomLayout, settings)

    // ── Two-line contact footer below the events panel ──
    const bpFY = PAGE_H - MARGIN - BP_FOOTER_H
    doc.setFillColor(248, 249, 252)
    doc.rect(MARGIN, bpFY, PAGE_W - MARGIN * 2, BP_FOOTER_H, 'F')
    doc.setDrawColor(225, 228, 234); doc.setLineWidth(0.4)
    doc.line(MARGIN, bpFY, PAGE_W - MARGIN, bpFY)
    const bpDetailParts = [
      schoolInfo.address,
      [schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : ''].filter(Boolean).join('   '),
      schoolInfo.email,
      schoolInfo.website,
    ].filter(Boolean)
    if (schoolInfo.name) {
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
      doc.text(schoolInfo.name, PAGE_W / 2, bpFY + 3.5, { align: 'center' })
    }
    if (bpDetailParts.length) {
      doc.setFontSize(4.8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 112, 135)
      doc.text(bpDetailParts.join('   ·   '), PAGE_W / 2, bpFY + 7, { align: 'center', maxWidth: PAGE_W - MARGIN * 4 })
    }
  }

  // ── Info card — empty 4th slot in row 2 (next to Jun / under Mar) ──────────
  {
    const ibX = MARGIN + 3 * (MONTH_W + 2)
    const ibY = rowStartY[2]
    const ibW = MONTH_W
    // In inline-notes mode extend the card flush to the bottom margin so there's no gap.
    // In bottom-panel mode keep it aligned with the other month blocks in that row.
    const ibH = showBottomPanel ? perRowMonthH[2] : Math.max(perRowMonthH[2], PAGE_H - MARGIN - CLASSIC_FOOTER_H - ibY)
    // Header scales down in compact (bottom-panel) mode so content has more room
    const isCompactCard = ibH < 55
    const IH_H = isCompactCard ? 8 : 12
    const PAD  = isCompactCard ? 3 : 5

    // White card
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(ibX, ibY, ibW, ibH, 4, 4, 'F')

    // Primary-color header strip — untouched
    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(ibX, ibY, ibW, IH_H, 1, 1, 'F')

    // Logo left-anchored; "School Information" and school name centered in header
    if (classicCircularLogo) {
      const lsz = IH_H - 2
      doc.addImage(classicCircularLogo, 'PNG', ibX + PAD, ibY + 1, lsz, lsz)
    }
    const ibCX = ibX + ibW / 2
    doc.setFontSize(isCompactCard ? 6 : 7); doc.setFont(titleFont, 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('School Information', ibCX, ibY + (isCompactCard ? 5 : 5.5), { align: 'center' })
    if (!isCompactCard) {
      doc.setFontSize(5.5); doc.setFont(titleFont, 'normal'); doc.setTextColor(200, 212, 232)
      doc.text(settings.calendarTitle || schoolInfo.name || 'YAYOE', ibCX, ibY + 9.5, { align: 'center' })
    }

    let cy2 = ibY + IH_H + PAD

    // ── Legend — 2-column grid, 20×14px swatches ───────────────────────────
    const visibleCatsIB = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
    if (visibleCatsIB.length > 0) {
      const SWATCH_W  = 5.3   // ~20px
      const SWATCH_H  = 3.7   // ~14px
      const LEG_ROW_H = isCompactCard ? 4.5 : 5.2   // ~10px gap
      const legCols2  = 2
      const legColW2  = (ibW - PAD * 2) / legCols2
      const TEXT_X_OFF = SWATCH_W + 1.5

      const catMax = Math.min(visibleCatsIB.length, 12)
      let legRowsDrawn = 0
      visibleCatsIB.slice(0, catMax).forEach((cat, i) => {
        const col  = i % legCols2
        const row  = Math.floor(i / legCols2)
        const itemX = ibX + PAD + col * legColW2
        const itemY = cy2 + row * LEG_ROW_H
        if (itemY + SWATCH_H > ibY + ibH - 2) return
        legRowsDrawn = Math.max(legRowsDrawn, row + 1)
        const [r, g, b] = cat.id === 'no-school'
          ? [208, 80, 80]  // #D05050 — no-school red
          : hexToRgbLocal(catColor(cat.id, cat.color))
        doc.setFillColor(r, g, b)
        doc.roundedRect(itemX, itemY, SWATCH_W, SWATCH_H, 0.5, 0.5, 'F')
        if (cat.id === 'no-school') {
          doc.setDrawColor(165, 50, 50); doc.setLineWidth(0.25)
          doc.roundedRect(itemX, itemY, SWATCH_W, SWATCH_H, 0.5, 0.5, 'S')
        }
        // Text baseline vertically centered with swatch
        doc.setTextColor(31, 45, 74); doc.setFontSize(isCompactCard ? 6 : 6.5); doc.setFont('helvetica', 'normal')
        doc.text(cat.name, itemX + TEXT_X_OFF, itemY + SWATCH_H * 0.72, { maxWidth: legColW2 - TEXT_X_OFF - 1 })
      })
      cy2 += legRowsDrawn * LEG_ROW_H + 2.5
    }

    // ── School Hours — gray shaded band, left-aligned label/time table ──────
    const hourLines2 = (schoolInfo.hours || '').split('\n').filter(l => l.trim())
    if (hourLines2.length && cy2 < ibY + ibH - 8) {
      const HOURS_ROW_H = isCompactCard ? 5.0 : 4.5
      const bandPadV    = 1.5
      const bandH       = Math.min(
        bandPadV * 2 + 4.0 + hourLines2.length * HOURS_ROW_H,
        ibY + ibH - 2 - cy2
      )
      // Gray background band
      doc.setFillColor(240, 243, 247)
      doc.rect(ibX + 1, cy2, ibW - 2, bandH, 'F')

      cy2 += bandPadV

      doc.setFontSize(isCompactCard ? 4.5 : 5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
      doc.text('SCHOOL HOURS', ibX + PAD, cy2); cy2 += 4.0

      // Split "Label: time" into two columns; fallback to full-width single line
      const labelColW = 14
      const timeX = ibX + PAD + labelColW
      const timeMaxW = ibW - PAD - labelColW - PAD
      doc.setFontSize(isCompactCard ? 6 : 6.5)
      hourLines2.forEach(line => {
        if (cy2 >= ibY + ibH - 2) return
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0 && colonIdx < 13) {
          const lbl  = line.slice(0, colonIdx + 1)
          const time = line.slice(colonIdx + 1).trim()
          doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
          doc.text(lbl, ibX + PAD, cy2)
          doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 60, 80)
          doc.text(time, timeX, cy2, { maxWidth: timeMaxW })
        } else {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 60, 80)
          doc.text(line.trim(), ibX + PAD, cy2, { maxWidth: ibW - PAD * 2 })
        }
        cy2 += HOURS_ROW_H
      })
      cy2 += bandPadV
    }

    // ── Footer — thin rule + centered contact info ──────────────────────────────
    const contactLines2 = !showBottomPanel ? [
      schoolInfo.otherInfo,
      schoolInfo.address,
      [schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : ''].filter(Boolean).join('   '),
      schoolInfo.email,
      schoolInfo.website,
    ].filter(Boolean) : []
    if (contactLines2.length && cy2 < ibY + ibH - 5) {
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.4)
      doc.line(ibX + PAD * 2, cy2 + 1.5, ibX + ibW - PAD * 2, cy2 + 1.5); cy2 += 4.5
      contactLines2.forEach((line, i) => {
        if (cy2 >= ibY + ibH - 2) return
        const isFirst = i === 0
        doc.setFontSize(isFirst ? (isCompactCard ? 5 : 5.5) : (isCompactCard ? 4.5 : 5))
        doc.setFont('helvetica', isFirst ? 'bold' : 'normal')
        doc.setTextColor(isFirst ? pr : 80, isFirst ? pg : 90, isFirst ? pb : 110)
        doc.text(line, ibCX, cy2, { align: 'center', maxWidth: ibW - PAD * 2 })
        cy2 += isFirst ? 4 : 3.4
      })
    }

    // Card border
    doc.setDrawColor(216, 220, 227); doc.setLineWidth(0.5)
    doc.roundedRect(ibX, ibY, ibW, ibH, 4, 4, 'S')
  }

  // ── Two-line contact footer (inline-notes mode only) ──────────────────────
  if (!showBottomPanel) {
    const cfY = PAGE_H - MARGIN - CLASSIC_FOOTER_H
    doc.setFillColor(248, 249, 252)
    doc.rect(MARGIN, cfY, PAGE_W - MARGIN * 2, CLASSIC_FOOTER_H, 'F')
    doc.setDrawColor(225, 228, 234); doc.setLineWidth(0.4)
    doc.line(MARGIN, cfY, PAGE_W - MARGIN, cfY)
    const cfDetailParts = [
      schoolInfo.address,
      [schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : ''].filter(Boolean).join('   '),
      schoolInfo.email,
      schoolInfo.website,
    ].filter(Boolean)
    if (schoolInfo.name) {
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
      doc.text(schoolInfo.name, PAGE_W / 2, cfY + 3.5, { align: 'center' })
    }
    if (cfDetailParts.length) {
      doc.setFontSize(4.8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 112, 135)
      doc.text(cfDetailParts.join('   ·   '), PAGE_W / 2, cfY + 7, { align: 'center', maxWidth: PAGE_W - MARGIN * 4 })
    }
  }

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}-${pdfStyle}.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// Traditional — landscape 4-col with inline notes strip under each month row
// Independent copy of Classic; modify freely without affecting Classic.
// ────────────────────────────────────────────────────────────────────────────
async function exportTraditional(state, ctx) {
  const { events, categories, schoolInfo, settings } = state
  const { preview, theme, doc, titleFont, shabbatLabel } = ctx
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)

  const isCompact = settings.template === 'compact'
  const showBottomPanel = settings.eventsPanel === 'bottom'

  const CLASSIC_FOOTER_H = showBottomPanel ? 0 : 9
  const GRID_W = PAGE_W - MARGIN * 2
  const MONTH_W = (GRID_W / COL_COUNT) - 2
  const MONTH_ROWS = 3
  const ROW_GAP = 3
  const HEADER_OFFSET = isCompact ? 9 : 10

  const MIN_CELL_H   = 2.5
  const MIN_GRID_H   = MONTH_ROWS * MIN_CELL_H * 6 + (MONTH_ROWS - 1) * ROW_GAP + MONTH_ROWS * HEADER_OFFSET
  const BP_FOOTER_H  = showBottomPanel ? 9 : 0
  const TOTAL_AVAIL  = PAGE_H - (HEADER_H + 2) - MARGIN - CLASSIC_FOOTER_H - BP_FOOTER_H
  const maxSafePanelH = Math.max(38, Math.floor(TOTAL_AVAIL - MIN_GRID_H))

  const bpPanelW = PAGE_W - MARGIN * 2 - 2
  const bottomLayout = showBottomPanel ? bpComputeLayout(doc, events, settings.academicYear, bpPanelW, maxSafePanelH) : null
  const dynamicPanelH = bottomLayout ? bottomLayout.panelH : 0
  const availH = showBottomPanel
    ? PAGE_H - (HEADER_H + 2) - MARGIN - dynamicPanelH - CLASSIC_FOOTER_H - BP_FOOTER_H
    : PAGE_H - (HEADER_H + 2) - MARGIN - CLASSIC_FOOTER_H
  const allMonths = getAcademicMonths(settings.academicYear)
  // Single pass: compute ideal layout height AND true minimum draw height per row
  // minH = actual space needed to render every event at 4pt (2.4mm/line + 3mm overhead)
  const perRowData = showBottomPanel
    ? Array(MONTH_ROWS).fill({ idealH: 0, minH: 0 })
    : Array.from({ length: MONTH_ROWS }, (_, row) => {
        const rowMonths = allMonths.filter((_, idx) => Math.floor(idx / COL_COUNT) === row)
        const counts = rowMonths.map(({ year, month }) => {
          const mk = `${year}-${String(month + 1).padStart(2, '0')}`
          const seen = new Set()
          Object.entries(events).forEach(([dk, evs]) => {
            if (!dk.startsWith(mk)) return
            ;(evs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => seen.add(`${ev.category}::${ev.label}`))
          })
          return seen.size
        })
        const maxEv = counts.length > 0 ? Math.max(...counts) : 0
        return {
          idealH: maxEv > 0 ? Math.max(16, maxEv * 5 + 8) : 0,
          minH:   maxEv > 0 ? Math.max(12, maxEv * 4 + 8) : 0,
        }
      })
  const totalNotesHIdeal = perRowData.reduce((s, d) => s + d.idealH, 0)
  const minTotalNotes    = perRowData.reduce((s, d) => s + d.minH,   0)
  const FIXED_H = (MONTH_ROWS - 1) * ROW_GAP + MONTH_ROWS * HEADER_OFFSET
  const baseCellH = Math.max(MIN_CELL_H, (availH - FIXED_H - totalNotesHIdeal) / (MONTH_ROWS * 6))
  // Boost 17.5%, capped so minH notes space is always preserved (no cut-off events)
  const maxCellH = (availH - FIXED_H - minTotalNotes) / (MONTH_ROWS * 6)
  const CELL_H = Math.min(maxCellH, Math.max(MIN_CELL_H, baseCellH * 1.175))
  // Remaining space → notes: each row guaranteed its minH, surplus distributed by idealH weight
  const gridUsed  = MONTH_ROWS * CELL_H * 6 + FIXED_H
  const notesAvail = Math.max(0, availH - gridUsed)
  const surplus    = Math.max(0, notesAvail - minTotalNotes)
  const perRowNotesH = perRowData.map(d =>
    d.minH === 0 ? 0 : d.minH + (totalNotesHIdeal > 0 ? Math.floor(surplus * d.idealH / totalNotesHIdeal) : 0)
  )
  const perRowMonthH = perRowNotesH.map(nh => CELL_H * 6 + HEADER_OFFSET + nh)

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, PAGE_W * 0.62, HEADER_H, 'F')
  doc.setFillColor(Math.min(255,pr+12), Math.min(255,pg+16), Math.min(255,pb+25))
  doc.rect(PAGE_W * 0.62, 0, PAGE_W * 0.38, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, HEADER_H - 1.5, PAGE_W, 1.5, 'F')

  const LOGO_SIZE = 11
  const logoY = (HEADER_H - LOGO_SIZE) / 2
  let tradCircularLogo = null
  if (schoolInfo.logo) {
    try {
      tradCircularLogo = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(tradCircularLogo, 'PNG', MARGIN, logoY, LOGO_SIZE, LOGO_SIZE)
    } catch {}
  }

  doc.setFillColor(ar, ag, ab)
  doc.rect(0, 0, 3, HEADER_H - 1.5, 'F')

  const titleX = MARGIN + LOGO_SIZE + 3
  const titleY = 2 + 4.5
  const yearLineY = titleY + 5

  const displayTitle = settings.calendarTitle || schoolInfo.name || 'YAYOE Calendar'
  doc.setFontSize(18)
  doc.setFont(titleFont, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(displayTitle, titleX, titleY)

  doc.setFontSize(10)
  doc.setFont(titleFont, 'normal')
  doc.setTextColor(200, 212, 232)
  const hebrewYear = settings.hebrewYear || ''
  const yearLine = settings.showHebrewYear !== false && hebrewYear
    ? `Academic Year  ${settings.academicYear || '2026–2027'}  •  ${hebrewYear}`
    : `Academic Year  ${settings.academicYear || '2026–2027'}`
  doc.text(yearLine, titleX, yearLineY)

  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50)
    doc.setFontSize(72)
    doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const holidayMap = getHolidayMap(settings.academicYear)
  const emojiCache = {}
  await Promise.all(
    [...new Set(Object.values(holidayMap).map(h => (settings.hebrewHolidayIcons || {})[h.group] || h.icon).filter(Boolean))].map(
      async icon => { emojiCache[icon] = await renderEmojiToImage(icon) }
    )
  )

  // ── Calendar Grid ──────────────────────────────────
  const startY = HEADER_H + 2
  const rowStartY = Array.from({ length: MONTH_ROWS }, (_, row) => {
    let y = startY
    for (let r = 0; r < row; r++) y += perRowMonthH[r] + ROW_GAP
    return y
  })

  allMonths.forEach(({ year, month }, idx) => {
    const row = Math.floor(idx / COL_COUNT)
    const col = idx % COL_COUNT
    const mx = MARGIN + col * (MONTH_W + 2)
    const mw = MONTH_W
    const y = rowStartY[row]
    const monthH = perRowMonthH[row]
    const notesH = perRowNotesH[row]
    const numWeeks = Math.ceil((getFirstDayOfWeek(year, month) + getDaysInMonth(year, month).length) / 7)
    drawMonth(doc, { year, month }, events, categories, settings, mx, y, mw, monthH, shabbatLabel, notesH, theme, emojiCache, titleFont, numWeeks, 4.0)
  })

  // ── Bottom Events Panel ──────────────────────────────
  if (showBottomPanel) {
    const panelTop = rowStartY[MONTH_ROWS - 1] + perRowMonthH[MONTH_ROWS - 1] + 2
    drawBottomEventsPanel(doc, categories, panelTop, PAGE_W, MARGIN, 0, bottomLayout, settings)

    const bpFY = PAGE_H - MARGIN - BP_FOOTER_H
    doc.setFillColor(248, 249, 252)
    doc.rect(MARGIN, bpFY, PAGE_W - MARGIN * 2, BP_FOOTER_H, 'F')
    doc.setDrawColor(225, 228, 234); doc.setLineWidth(0.4)
    doc.line(MARGIN, bpFY, PAGE_W - MARGIN, bpFY)
    const bpDetailParts2 = [
      schoolInfo.address,
      [schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : ''].filter(Boolean).join('   '),
      schoolInfo.email,
      schoolInfo.website,
    ].filter(Boolean)
    if (schoolInfo.name) {
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
      doc.text(schoolInfo.name, PAGE_W / 2, bpFY + 3.5, { align: 'center' })
    }
    if (bpDetailParts2.length) {
      doc.setFontSize(4.8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 112, 135)
      doc.text(bpDetailParts2.join('   ·   '), PAGE_W / 2, bpFY + 7, { align: 'center', maxWidth: PAGE_W - MARGIN * 4 })
    }
  }

  // ── Info card ──────────────────────────────────────
  {
    const ibX = MARGIN + 3 * (MONTH_W + 2)
    const ibY = rowStartY[2]
    const ibW = MONTH_W
    const ibH = showBottomPanel ? perRowMonthH[2] : Math.max(perRowMonthH[2], PAGE_H - MARGIN - CLASSIC_FOOTER_H - ibY)
    const isCompactCard = ibH < 55
    const IH_H = isCompactCard ? 8 : 12
    const PAD  = isCompactCard ? 3 : 5

    doc.setFillColor(255, 255, 255)
    doc.roundedRect(ibX, ibY, ibW, ibH, 4, 4, 'F')

    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(ibX, ibY, ibW, IH_H, 1, 1, 'F')

    if (tradCircularLogo) {
      const lsz = IH_H - 2
      doc.addImage(tradCircularLogo, 'PNG', ibX + PAD, ibY + 1, lsz, lsz)
    }
    const ibCX = ibX + ibW / 2
    doc.setFontSize(isCompactCard ? 6 : 7); doc.setFont(titleFont, 'bold'); doc.setTextColor(255, 255, 255)
    doc.text('School Information', ibCX, ibY + (isCompactCard ? 5 : 5.5), { align: 'center' })
    if (!isCompactCard) {
      doc.setFontSize(5.5); doc.setFont(titleFont, 'normal'); doc.setTextColor(200, 212, 232)
      doc.text(settings.calendarTitle || schoolInfo.name || 'YAYOE', ibCX, ibY + 9.5, { align: 'center' })
    }

    let cy2 = ibY + IH_H + PAD

    const visibleCatsIB = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
    if (visibleCatsIB.length > 0) {
      const SWATCH_W  = 5.3
      const SWATCH_H  = 3.7
      const LEG_ROW_H = isCompactCard ? 4.5 : 5.2
      const legCols2  = 2
      const legColW2  = (ibW - PAD * 2) / legCols2
      const TEXT_X_OFF = SWATCH_W + 1.5

      const catMax = Math.min(visibleCatsIB.length, 12)
      let legRowsDrawn = 0
      visibleCatsIB.slice(0, catMax).forEach((cat, i) => {
        const col  = i % legCols2
        const row  = Math.floor(i / legCols2)
        const itemX = ibX + PAD + col * legColW2
        const itemY = cy2 + row * LEG_ROW_H
        if (itemY + SWATCH_H > ibY + ibH - 2) return
        legRowsDrawn = Math.max(legRowsDrawn, row + 1)
        const [r, g, b] = cat.id === 'no-school'
          ? [208, 80, 80]
          : hexToRgbLocal(catColor(cat.id, cat.color))
        doc.setFillColor(r, g, b)
        doc.roundedRect(itemX, itemY, SWATCH_W, SWATCH_H, 0.5, 0.5, 'F')
        if (cat.id === 'no-school') {
          doc.setDrawColor(165, 50, 50); doc.setLineWidth(0.25)
          doc.roundedRect(itemX, itemY, SWATCH_W, SWATCH_H, 0.5, 0.5, 'S')
        }
        doc.setTextColor(31, 45, 74); doc.setFontSize(isCompactCard ? 6 : 6.5); doc.setFont('helvetica', 'normal')
        doc.text(cat.name, itemX + TEXT_X_OFF, itemY + SWATCH_H * 0.72, { maxWidth: legColW2 - TEXT_X_OFF - 1 })
      })
      cy2 += legRowsDrawn * LEG_ROW_H + 2.5
    }

    const hourLines2 = (schoolInfo.hours || '').split('\n').filter(l => l.trim())
    if (hourLines2.length && cy2 < ibY + ibH - 8) {
      const HOURS_ROW_H = isCompactCard ? 5.0 : 4.5
      const bandPadV    = 1.5
      const bandH       = Math.min(
        bandPadV * 2 + 4.0 + hourLines2.length * HOURS_ROW_H,
        ibY + ibH - 2 - cy2
      )
      doc.setFillColor(240, 243, 247)
      doc.rect(ibX + 1, cy2, ibW - 2, bandH, 'F')

      cy2 += bandPadV

      doc.setFontSize(isCompactCard ? 4.5 : 5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
      doc.text('SCHOOL HOURS', ibX + PAD, cy2); cy2 += 4.0

      const labelColW = 14
      const timeX = ibX + PAD + labelColW
      const timeMaxW = ibW - PAD - labelColW - PAD
      doc.setFontSize(isCompactCard ? 6 : 6.5)
      hourLines2.forEach(line => {
        if (cy2 >= ibY + ibH - 2) return
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0 && colonIdx < 13) {
          const lbl  = line.slice(0, colonIdx + 1)
          const time = line.slice(colonIdx + 1).trim()
          doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
          doc.text(lbl, ibX + PAD, cy2)
          doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 60, 80)
          doc.text(time, timeX, cy2, { maxWidth: timeMaxW })
        } else {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 60, 80)
          doc.text(line.trim(), ibX + PAD, cy2, { maxWidth: ibW - PAD * 2 })
        }
        cy2 += HOURS_ROW_H
      })
      cy2 += bandPadV
    }

    const contactLines2 = !showBottomPanel ? [
      schoolInfo.otherInfo,
      schoolInfo.address,
      [schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : ''].filter(Boolean).join('   '),
      schoolInfo.email,
      schoolInfo.website,
    ].filter(Boolean) : []
    if (contactLines2.length && cy2 < ibY + ibH - 5) {
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.4)
      doc.line(ibX + PAD * 2, cy2 + 1.5, ibX + ibW - PAD * 2, cy2 + 1.5); cy2 += 4.5
      contactLines2.forEach((line, i) => {
        if (cy2 >= ibY + ibH - 2) return
        const isFirst = i === 0
        doc.setFontSize(isFirst ? (isCompactCard ? 5 : 5.5) : (isCompactCard ? 4.5 : 5))
        doc.setFont('helvetica', isFirst ? 'bold' : 'normal')
        doc.setTextColor(isFirst ? pr : 80, isFirst ? pg : 90, isFirst ? pb : 110)
        doc.text(line, ibCX, cy2, { align: 'center', maxWidth: ibW - PAD * 2 })
        cy2 += isFirst ? 4 : 3.4
      })
    }

    doc.setDrawColor(216, 220, 227); doc.setLineWidth(0.5)
    doc.roundedRect(ibX, ibY, ibW, ibH, 4, 4, 'S')
  }

  // ── Two-line contact footer ────────────────────────
  if (!showBottomPanel) {
    const cfY = PAGE_H - MARGIN - CLASSIC_FOOTER_H
    doc.setFillColor(248, 249, 252)
    doc.rect(MARGIN, cfY, PAGE_W - MARGIN * 2, CLASSIC_FOOTER_H, 'F')
    doc.setDrawColor(225, 228, 234); doc.setLineWidth(0.4)
    doc.line(MARGIN, cfY, PAGE_W - MARGIN, cfY)
    const cfDetailParts2 = [
      schoolInfo.address,
      [schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : ''].filter(Boolean).join('   '),
      schoolInfo.email,
      schoolInfo.website,
    ].filter(Boolean)
    if (schoolInfo.name) {
      doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
      doc.text(schoolInfo.name, PAGE_W / 2, cfY + 3.5, { align: 'center' })
    }
    if (cfDetailParts2.length) {
      doc.setFontSize(4.8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 112, 135)
      doc.text(cfDetailParts2.join('   ·   '), PAGE_W / 2, cfY + 7, { align: 'center', maxWidth: PAGE_W - MARGIN * 4 })
    }
  }

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}-traditional.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// Portrait Classic — 2-column portrait, month header on top, notes on right
// ────────────────────────────────────────────────────────────────────────────
async function exportPortraitClassic(state, { preview = false } = {}) {
  const { events, categories, schoolInfo, settings } = state

  // Premium palette — fixed for this style regardless of theme
  const NAVY   = [27, 42, 74]          // #1B2A4A — deep primary navy
  const NAVY2  = [40, 58, 98]          // slightly lighter for header gradient
  const GOLD   = [201, 168, 76]        // #C9A84C — accent gold
  const DAY_HDR_BG  = [238, 241, 246]  // #EEF1F6 — day-of-week row bg
  const DAY_HDR_TXT = [74, 85, 104]    // #4A5568
  const SHA_BG      = [240, 242, 247]  // #F0F2F7 — very subtle Shabbat tint
  const GRID_LINE   = [226, 232, 240]  // #E2E8F0
  const PANEL_BORDER = [209, 217, 230] // #D1D9E6
  const HEB_TXT     = [138, 153, 176]  // #8A99B0 — muted Hebrew subtitle
  const FOOTER_BG   = [247, 249, 252]  // #F7F9FC
  const SUBTITLE_TXT = [184, 200, 224] // #B8C8E0
  const [pr, pg, pb] = NAVY
  const [ar, ag, ab] = GOLD

  // Slight desaturation so event colors feel refined rather than primary-RGB vivid
  const desat = (r, g, b, amt = 0.18) => {
    const gr = 0.299 * r + 0.587 * g + 0.114 * b
    return [Math.round(r + (gr - r) * amt), Math.round(g + (gr - g) * amt), Math.round(b + (gr - b) * amt)]
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const hasMontserrat = await loadMontserrat(doc)
  const titleFont = hasMontserrat ? 'Montserrat' : 'helvetica'
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'

  const PW = 215.9, PH = 279.4
  const MARGIN = 5
  const HEADER_H = 15       // +1mm taller header
  const FOOTER_H = 17       // +1mm taller footer
  const COL_COUNT = 2
  const MONTH_ROWS = 6
  const ROW_GAP = 2
  const COL_GAP = 2.5       // slightly wider column gutter
  const BLOCK_HEADER_H = 6  // +1mm taller month header bar
  const NOTES_W = 36
  const INNER_GAP = 2       // wider gap between calendar grid and notes
  const GOLD_STRIPE = 1.2   // gold left-accent stripe on month header
  const DOW_H = 4            // +0.5mm taller day-of-week row

  const GRID_W = PW - MARGIN * 2
  const MONTH_W = (GRID_W - COL_GAP) / COL_COUNT
  const CAL_W = MONTH_W - NOTES_W - INNER_GAP
  const cellW = CAL_W / 7
  const availH = PH - (HEADER_H + 2) - MARGIN - FOOTER_H - 2
  const MONTH_H = (availH - (MONTH_ROWS - 1) * ROW_GAP) / MONTH_ROWS
  const cellH = (MONTH_H - BLOCK_HEADER_H - DOW_H) / 6

  // ── Header — dark navy with subtle top-gradient + gold rule ─────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, HEADER_H, 'F')
  // Subtle lighter strip at top for gradient illusion
  doc.setFillColor(...NAVY2)
  doc.setGState(doc.GState({ opacity: 0.35 }))
  doc.rect(0, 0, PW, HEADER_H * 0.45, 'F')
  doc.setGState(doc.GState({ opacity: 1.0 }))
  // Gold rule
  doc.setFillColor(...GOLD)
  doc.rect(0, HEADER_H - 1.1, PW, 1.1, 'F')

  const LOGO_SIZE = 11
  let circularLogo = null
  if (schoolInfo.logo) {
    try {
      circularLogo = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(circularLogo, 'PNG', MARGIN, (HEADER_H - LOGO_SIZE) / 2, LOGO_SIZE, LOGO_SIZE)
    } catch {}
  }

  const titleX = MARGIN + (circularLogo ? LOGO_SIZE + 3 : 0)
  // School name — larger, bold, with letter-spacing
  doc.setFontSize(13); doc.setFont(titleFont, 'bold'); doc.setTextColor(255, 255, 255)
  doc.text(settings.calendarTitle || schoolInfo.name || 'YAYOE Calendar', titleX, 6.8, { charSpace: 0.18 })
  // Academic year subtitle in muted blue-white
  doc.setFontSize(7); doc.setFont(titleFont, 'normal'); doc.setTextColor(...SUBTITLE_TXT)
  const hebrewYearStr = settings.hebrewYear || ''
  const yearLine = settings.showHebrewYear !== false && hebrewYearStr
    ? `Academic Year  ${settings.academicYear || '2026–2027'}  •  ${hebrewYearStr}`
    : `Academic Year  ${settings.academicYear || '2026–2027'}`
  doc.text(yearLine, titleX, 11.5)

  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PW / 2, PH / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  // Pre-render Hebrew holiday emoji
  const holidayMap = getHolidayMap(settings.academicYear)
  const emojiCache = {}
  await Promise.all(
    [...new Set(Object.values(holidayMap).map(h => (settings.hebrewHolidayIcons || {})[h.group] || h.icon).filter(Boolean))].map(
      async icon => { emojiCache[icon] = await renderEmojiToImage(icon) }
    )
  )

  // ── Calendar grid ────────────────────────────────────────────────────────
  const startY = HEADER_H + 2
  const allMonths = getAcademicMonths(settings.academicYear)
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  // Build full cross-month run groups so notes show complete date ranges
  const allEventRanges = {}
  Object.entries(events).forEach(([dk, dayEvs]) => {
    ;(dayEvs || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
      const key = `${ev.category}::${ev.label}`
      if (!allEventRanges[key]) allEventRanges[key] = []
      allEventRanges[key].push(dk)
    })
  })
  const allEventRunGroups = {}
  Object.entries(allEventRanges).forEach(([key, allDates]) => {
    allEventRunGroups[key] = groupConsecutiveDates([...allDates].sort())
  })
  const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  allMonths.forEach(({ year, month }, idx) => {
    const col = idx % COL_COUNT
    const row = Math.floor(idx / COL_COUNT)
    const mx = MARGIN + col * (MONTH_W + COL_GAP)
    const my = startY + row * (MONTH_H + ROW_GAP)

    // ── Pseudo drop-shadow ────────────────────────────────────────────────
    doc.setFillColor(180, 190, 210)
    doc.setGState(doc.GState({ opacity: 0.35 }))
    doc.roundedRect(mx + 0.7, my + 0.7, MONTH_W, MONTH_H, 1.2, 1.2, 'F')
    doc.setGState(doc.GState({ opacity: 1.0 }))

    // ── Month panel white background ──────────────────────────────────────
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(mx, my, MONTH_W, MONTH_H, 1.2, 1.2, 'F')

    // ── Month header bar — navy with gold left stripe ──────────────────────
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hLabel = getHebrewMonthLabel(year, month)
    // Navy fill — full rounded rect then square off bottom corners
    doc.setFillColor(...NAVY)
    doc.roundedRect(mx, my, MONTH_W, BLOCK_HEADER_H, 1.2, 1.2, 'F')
    doc.rect(mx, my + BLOCK_HEADER_H / 2, MONTH_W, BLOCK_HEADER_H / 2, 'F')
    // Gold left accent stripe
    doc.setFillColor(...GOLD)
    doc.rect(mx, my, GOLD_STRIPE, BLOCK_HEADER_H, 'F')

    // Month name — white, bold, slightly larger
    const textBaseY = my + BLOCK_HEADER_H * 0.7
    doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont(titleFont, 'bold')
    const engPart = `${mName} ${year}`
    doc.text(engPart, mx + GOLD_STRIPE + 1.8, textBaseY)
    // Hebrew label — muted color, lighter weight
    if (hLabel) {
      const engW = doc.getTextWidth(engPart)
      doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...HEB_TXT)
      doc.text(`  ·  ${hLabel}`, mx + GOLD_STRIPE + 1.8 + engW, textBaseY, { maxWidth: MONTH_W - GOLD_STRIPE - engW - 4 })
    }

    // ── Day-of-week header row ─────────────────────────────────────────────
    const calX = mx
    const dowRowTop = my + BLOCK_HEADER_H
    const dowTextY = dowRowTop + DOW_H * 0.72

    // Light blue-gray bg across the full DOW row
    doc.setFillColor(...DAY_HDR_BG)
    doc.rect(calX, dowRowTop, CAL_W, DOW_H, 'F')

    DOW_LABELS.forEach((d, i) => {
      const lx = calX + i * cellW
      if (i === 6) {
        // SHA column: very subtle differentiation within the DOW row
        doc.setFillColor(...SHA_BG)
        doc.rect(lx, dowRowTop, cellW, DOW_H, 'F')
      }
      doc.setTextColor(...DAY_HDR_TXT)
      doc.setFontSize(3.8); doc.setFont('helvetica', 'bold')
      doc.text(
        d === 'S' && i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d,
        lx + cellW / 2, dowTextY, { align: 'center' }
      )
    })

    // ── Day cells ──────────────────────────────────────────────────────────
    const days = getDaysInMonth(year, month)
    const startDow = getFirstDayOfWeek(year, month)

    const noSchoolMap = {}
    const earlyDismissMap = {}
    days.forEach(date => {
      const dk = formatDateKey(date)
      ;(events[dk] || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
        const cat = catMap[ev.category]
        const cname = cat?.name?.toLowerCase() || ''
        if (ev.category === 'no-school' || cname.includes('no school'))
          noSchoolMap[dk] = { label: ev.label }
        if (ev.category === 'early-dismissal' || cname.includes('dismissal'))
          earlyDismissMap[dk] = { label: ev.label, time: ev.time, color: ev.color || cat?.color || '#D68910' }
      })
    })

    days.forEach(date => {
      const dayNum = date.getDate()
      const dow = (startDow + dayNum - 1) % 7
      const weekRow = Math.floor((startDow + dayNum - 1) / 7)
      const cx = calX + dow * cellW
      const cy = my + BLOCK_HEADER_H + DOW_H + weekRow * cellH
      const dk = formatDateKey(date)
      const isNoSchool = !!noSchoolMap[dk]
      const isEarlyDismiss = !!earlyDismissMap[dk]
      const dayEvs = (events[dk] || []).filter(e => e.category !== 'rosh-chodesh')

      // SHA column background
      if (dow === 6) {
        doc.setFillColor(...SHA_BG)
        doc.rect(cx, cy, cellW, cellH, 'F')
      }

      if (isNoSchool) {
        doc.setFillColor(208, 80, 80)  // #D05050 — no-school red
        doc.roundedRect(cx + 0.1, cy + 0.1, cellW - 0.2, cellH - 0.2, 0.4, 0.4, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 0.7, cy + 2.9)
      } else if (isEarlyDismiss) {
        const ed = earlyDismissMap[dk]
        const [r, g, b] = desat(...hexToRgbLocal(ed.color))
        doc.setFillColor(r, g, b)
        doc.roundedRect(cx + 0.1, cy + 0.1, cellW - 0.2, cellH - 0.2, 0.4, 0.4, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 0.7, cy + 2.9)
        if (ed.time) {
          doc.setFontSize(3); doc.setFont('helvetica', 'normal')
          doc.text(formatTime(ed.time), cx + 0.7, cy + cellH - 0.6, { maxWidth: cellW - 1 })
        }
      } else if (settings.cellStyle === 'filled' && dayEvs.length > 0) {
        const firstEv = dayEvs[0]
        const cat = catMap[firstEv.category]
        const [r, g, b] = desat(...hexToRgbLocal(firstEv.color || cat?.color || '#999'))
        doc.setFillColor(r, g, b)
        doc.roundedRect(cx + 0.1, cy + 0.1, cellW - 0.2, cellH - 0.2, 0.4, 0.4, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 0.7, cy + 2.9)
        if (firstEv.label) {
          doc.setFontSize(2.8); doc.setFont('helvetica', 'normal')
          doc.text(firstEv.label, cx + 0.7, cy + 2.9 + 1.9, { maxWidth: cellW - 1 })
        }
      } else {
        // Normal day — larger, bolder date number for clear hierarchy
        doc.setTextColor(dow === 6 ? 74 : 28, dow === 6 ? 85 : 38, dow === 6 ? 104 : 62)
        doc.setFontSize(5); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 0.7, cy + 2.9)
        // Rosh Chodesh dot
        if (getRoshChodeshMap(settings.academicYear)[dk]) {
          doc.setFillColor(195, 177, 225)
          doc.circle(cx + cellW - 1.3, cy + 1.2, 0.7, 'F')
        }
        // Event color dots (max 2) — slightly larger for visibility
        dayEvs.slice(0, 2).forEach((ev, ei) => {
          const cat = catMap[ev.category]
          const [r, g, b] = desat(...hexToRgbLocal(ev.color || cat?.color || '#999'))
          doc.setFillColor(r, g, b)
          doc.circle(cx + 1.0 + ei * 2.0, cy + cellH - 1.0, 0.72, 'F')
        })
      }

      // Hebrew holiday emoji (top-right corner)
      const hHoliday = getHolidayMap(settings.academicYear)[dk]
      if (hHoliday) {
        const icon = (settings.hebrewHolidayIcons || {})[hHoliday.group] || hHoliday.icon
        if (icon && emojiCache[icon]) {
          try { doc.addImage(emojiCache[icon], 'PNG', cx + cellW - 2.8, cy + 0.2, 2.5, 2.5) } catch {}
        }
      }
    })

    // ── Grid lines — very light ────────────────────────────────────────────
    const gridTop = my + BLOCK_HEADER_H
    doc.setDrawColor(...GRID_LINE); doc.setLineWidth(0.1)
    for (let r = 0; r <= 6; r++)
      doc.line(calX, gridTop + DOW_H + r * cellH, calX + CAL_W, gridTop + DOW_H + r * cellH)
    for (let c = 0; c <= 7; c++)
      doc.line(calX + c * cellW, gridTop, calX + c * cellW, my + MONTH_H)

    // ── Month panel border ─────────────────────────────────────────────────
    doc.setDrawColor(...PANEL_BORDER); doc.setLineWidth(0.4)
    doc.roundedRect(mx, my, MONTH_W, MONTH_H, 1.2, 1.2, 'S')

    // ── Notes/legend column ────────────────────────────────────────────────
    const notesX = calX + CAL_W + INNER_GAP

    // Subtle left border separating calendar from legend
    doc.setDrawColor(...PANEL_BORDER); doc.setLineWidth(0.6)
    doc.line(notesX - INNER_GAP * 0.5, my + BLOCK_HEADER_H + 2, notesX - INNER_GAP * 0.5, my + MONTH_H - 2)

    // Collect notes using full run groups
    const seenEvts = new Map()
    days.forEach(date => {
      const dk = formatDateKey(date)
      ;(events[dk] || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        const runGroups = allEventRunGroups[key] || [[dk]]
        const groupIdx = runGroups.findIndex(g => g.includes(dk))
        const idx = groupIdx >= 0 ? groupIdx : 0
        const entryKey = runGroups.length > 1 ? `${key}::r${idx}` : key
        if (!seenEvts.has(entryKey)) {
          seenEvts.set(entryKey, { ev, dates: runGroups[idx] || [dk] })
        }
      })
    })

    let noteY = my + BLOCK_HEADER_H + 4
    const maxNoteY = my + MONTH_H - 1.5
    for (const { ev, dates } of seenEvts.values()) {
      if (noteY > maxNoteY) break
      const cat = catMap[ev.category]
      const [r, g, b] = hexToRgbLocal(ev.color || cat?.color || '#999')
      // Square swatch (~2.1×2.1mm = 6×6pt)
      doc.setFillColor(r, g, b)
      doc.roundedRect(notesX, noteY - 2.1, 2.1, 2.1, 0.25, 0.25, 'F')
      // Label (colored) + time + range (muted)
      const isED = ev.category === 'early-dismissal' || (cat?.name?.toLowerCase() || '').includes('dismissal')
      const timeStr = isED && ev.time ? ` ${formatTime(ev.time)}` : ''
      const groups = groupConsecutiveDates([...dates].sort())
      const rangeStr = formatRangeGroups(groups)
      const rangePart = `  –  ${rangeStr}`
      doc.setFontSize(5); doc.setFont('helvetica', 'normal')
      const reservedW = doc.getTextWidth(timeStr + rangePart)
      const maxLabelW = Math.max(NOTES_W - 5 - reservedW, 6)
      const displayLabel = doc.splitTextToSize(ev.label, maxLabelW)[0] || ev.label
      const labelW = doc.getTextWidth(displayLabel)
      doc.setTextColor(r, g, b)
      doc.text(displayLabel, notesX + 3.2, noteY)
      if (timeStr) doc.text(timeStr, notesX + 3.2 + labelW, noteY)
      doc.setTextColor(90, 95, 110)
      doc.text(rangePart, notesX + 3.2 + labelW + doc.getTextWidth(timeStr), noteY)
      noteY += 4.0   // increased leading between legend items
    }
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = PH - MARGIN - FOOTER_H

  // Gold rule above footer — mirrors header gold rule
  doc.setFillColor(...GOLD)
  doc.rect(MARGIN, footerY, GRID_W, 1.1, 'F')

  // Footer background — warm off-white
  doc.setFillColor(...FOOTER_BG)
  doc.rect(MARGIN, footerY + 1.1, GRID_W, FOOTER_H - 1.1, 'F')
  doc.setDrawColor(...PANEL_BORDER); doc.setLineWidth(0.2)
  doc.rect(MARGIN, footerY + 1.1, GRID_W, FOOTER_H - 1.1, 'S')

  const footBottom = footerY + FOOTER_H - 1.5

  // §1: Logo + school name + contact
  const FOOT_LOGO_SZ = 11
  const footLogoX = MARGIN + 2
  const footLogoY = footerY + (FOOTER_H - FOOT_LOGO_SZ) / 2 + 0.5
  if (circularLogo) doc.addImage(circularLogo, 'PNG', footLogoX, footLogoY, FOOT_LOGO_SZ, FOOT_LOGO_SZ)
  const footInfoX = footLogoX + FOOT_LOGO_SZ + 2.5
  const footInfoMaxW = 52
  doc.setFontSize(6.5); doc.setFont(titleFont, 'bold'); doc.setTextColor(pr, pg, pb)
  doc.text(schoolInfo.name || 'YAYOE', footInfoX, footerY + 5.5, { maxWidth: footInfoMaxW })
  let fcy = footerY + 9
  const footLine = (text, color) => {
    if (!text || fcy > footBottom) return
    doc.setTextColor(...color)
    doc.text(doc.splitTextToSize(String(text), footInfoMaxW)[0] || '', footInfoX, fcy)
    fcy += 2.8
  }
  doc.setFontSize(4); doc.setFont('helvetica', 'italic')
  footLine(schoolInfo.otherInfo, [pr, pg, pb])
  doc.setFont('helvetica', 'normal')
  footLine(schoolInfo.address, [90, 100, 120])
  const phoneFaxStr = [schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : ''].filter(Boolean).join('   ')
  footLine(phoneFaxStr, [90, 100, 120])
  footLine(schoolInfo.email, [42, 100, 180])
  footLine(schoolInfo.website, [42, 100, 180])

  // §2: Hours
  const footDiv1X = MARGIN + 72
  doc.setDrawColor(...PANEL_BORDER); doc.setLineWidth(0.3)
  doc.line(footDiv1X, footerY + 3, footDiv1X, footerY + FOOTER_H - 2)
  const footHoursX = footDiv1X + 5
  const hourLines = (schoolInfo.hours || '').split('\n').filter(l => l.trim())
  if (hourLines.length) {
    doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
    doc.text('SCHOOL HOURS', footHoursX, footerY + 5.5)
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 60, 80)
    hourLines.forEach((line, i) => {
      const lineY = footerY + 9 + i * 2.8
      if (lineY <= footBottom) doc.text(line.trim(), footHoursX, lineY, { maxWidth: 52 })
    })
  }

  // §3: Legend
  const footDiv2X = MARGIN + 128
  doc.setDrawColor(...PANEL_BORDER); doc.setLineWidth(0.3)
  doc.line(footDiv2X, footerY + 3, footDiv2X, footerY + FOOTER_H - 2)
  const footLegX = footDiv2X + 4
  const footLegW = PW - MARGIN - footLegX - 2
  const visibleCatsFooter = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
  doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
  doc.text('LEGEND', footLegX, footerY + 5.5)
  const legCols = 3
  const legColW = footLegW / legCols
  visibleCatsFooter.slice(0, legCols * 2).forEach((cat, i) => {
    const col = i % legCols
    const row = Math.floor(i / legCols)
    const itemY = footerY + 9 + row * 3.5
    if (itemY > footBottom) return
    // Slightly larger swatch (~2.8×2.8mm ≈ 8×8pt) with subtle border
    const [r, g, b] = cat.id === 'no-school'
      ? [208, 80, 80]  // #D05050 — no-school red
      : hexToRgbLocal(catColor(cat.id, cat.color))
    const itemX = footLegX + col * legColW
    doc.setFillColor(r, g, b)
    doc.roundedRect(itemX, itemY - 2.5, 2.8, 2.8, 0.3, 0.3, 'F')
    doc.setDrawColor(cat.id === 'no-school' ? 165 : Math.max(0, r - 35), cat.id === 'no-school' ? 50 : Math.max(0, g - 35), cat.id === 'no-school' ? 50 : Math.max(0, b - 35))
    doc.setLineWidth(0.15)
    doc.roundedRect(itemX, itemY - 2.5, 2.8, 2.8, 0.3, 0.3, 'S')
    doc.setTextColor(31, 45, 74); doc.setFontSize(5); doc.setFont('helvetica', 'normal')
    doc.text(cat.name, itemX + 3.8, itemY, { maxWidth: legColW - 5 })
  })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}-portrait-classic.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// Shared helper: draw a single mini month grid onto an existing doc
// ────────────────────────────────────────────────────────────────────────────
// Short display names for Hebrew holidays in mini month cells (limited space)
const MINI_HOLIDAY_ABBREV = {
  'Rosh Hashana': 'R.H.',
  'Yom Kippur': 'Y.K.',
  'Sukkos': 'Sukkos',
  'Sukkot': 'Sukkot',
  'Chol HaMoed': 'Ch.H.',
  'Hoshana Raba': 'H.R.',
  'Shmini Atzeres': 'Shm.A.',
  'Shemini Atzeret': 'Shm.A.',
  'Simchas Torah': 'Sim.T.',
  'Simchat Torah': 'Sim.T.',
  'Chanukah': 'Chanukah',
  'Tzom Gedalya': 'Tzm.G.',
  'Tzom Gedalyah': 'Tzm.G.',
  "Asara B'Teves": "Asara B.",
  "Asara B'Tevet": "Asara B.",
  'Taanis Esther': 'Taan.E.',
  "Ta'anit Esther": 'Taan.E.',
  'Erev Shavuos': 'E.Shav.',
  'Erev Shavuot': 'E.Shav.',
  'Purim': 'Purim',
  'Shushan Purim': 'Shsh.P.',
  'Pesach': 'Pesach',
  'Shavuos': 'Shavuos',
  'Shavuot': 'Shavuot',
  "Tu B'Shvat": "Tu B'Sh.",
  'Yom HaZikaron': 'Yom Z.',
  'Yom HaAtzmaut': 'Yom H.',
  "Lag B'Omer": "Lag B'O.",
  'Fast Day': 'Fast',
}

// Smart label abbreviation: MINI_HOLIDAY_ABBREV first, then word-boundary truncation
function smartAbbrevLabel(label) {
  if (!label) return ''
  if (MINI_HOLIDAY_ABBREV[label]) return MINI_HOLIDAY_ABBREV[label]
  if (label.length <= 12) return label
  const words = label.split(' ')
  let result = ''
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word
    if (candidate.length > 11) break
    result = candidate
  }
  if (!result || result.length < 3) return label.slice(0, 11)
  return result.length < label.length ? result + '.' : result
}

function drawMiniMonth(doc, { year, month }, events, categories, settings, {
  x, y, w, h, pr, pg, pb, ar, ag, ab, titleFont, shabbatLabel, showEvents = true,
  glanceMode = false,   // Year at a Glance: smart labels, multi-day run detection, no double badges
  modernStyle = false,  // Clean Minimal: gradient headers, bold dates, warm tints, hairline borders
  colorOverrides = null,
}) {
  const days = getDaysInMonth(year, month)
  const startDow = getFirstDayOfWeek(year, month)
  const cellW = w / 7
  const HEADER_H = glanceMode ? 9 : 8
  const DAY_H = glanceMode ? 5.5 : 5
  const cellH = (h - HEADER_H - DAY_H) / 6

  // glanceMode: pre-detect multi-day runs so we only show label text in the first cell per row-segment
  let runDateKeys = null, runLabelDateKeys = null
  if (glanceMode) {
    const runArr = []
    let cur = null
    days.forEach(date => {
      const dayNum = date.getDate()
      const weekRow = Math.floor((startDow + dayNum - 1) / 7)
      const dateKey = formatDateKey(date)
      const ev = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')[0] || null
      const cont = ev && cur && cur.label === ev.label && cur.category === ev.category
      if (cont) { cur.count++; cur.dates.push({ dateKey, weekRow }) }
      else {
        if (cur && cur.count >= 2) runArr.push(cur)
        cur = ev ? { label: ev.label, category: ev.category, count: 1, dates: [{ dateKey, weekRow }] } : null
      }
    })
    if (cur && cur.count >= 2) runArr.push(cur)
    runDateKeys = new Set()
    runLabelDateKeys = new Set()
    runArr.forEach(run => {
      let lastRow = -1
      run.dates.forEach(({ dateKey, weekRow }) => {
        runDateKeys.add(dateKey)
        if (weekRow !== lastRow) { runLabelDateKeys.add(dateKey); lastRow = weekRow }
      })
    })
  }

  // Month header bar
  if (modernStyle) {
    // Simulate horizontal gradient #1A2E4A → #243D5F for subtle depth
    const steps = Math.ceil(w)
    const r1 = 26, g1 = 46, b1 = 74, r2 = 36, g2 = 61, b2 = 95
    for (let s = 0; s < steps; s++) {
      const t = s / Math.max(steps - 1, 1)
      doc.setFillColor(Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t))
      doc.rect(x + (s / steps) * w, y, w / steps + 0.1, HEADER_H, 'F')
    }
  } else {
    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(x, y, w, HEADER_H, 1, 1, 'F')
  }
  doc.setFillColor(ar, ag, ab)
  doc.rect(x, y + HEADER_H - (glanceMode ? 2 : 1.5), w, glanceMode ? 2 : 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(modernStyle ? 7 : glanceMode ? 7 : 6); doc.setFont(titleFont, 'bold')
  const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
  const heLabel = getHebrewMonthLabel(year, month)
  const headerTextY = y + (glanceMode ? 6.2 : 5.8)
  doc.text(mName, x + 2, headerTextY, { maxWidth: modernStyle ? w * 0.52 : glanceMode ? w * 0.56 : w - 4 })
  if (heLabel) {
    if (glanceMode) {
      doc.setFontSize(4.8); doc.setFont('helvetica', 'italic')
      doc.setTextColor(ar, ag, ab)
      doc.text(heLabel, x + w - 2, headerTextY, { align: 'right', maxWidth: w * 0.42 })
    } else {
      doc.setFontSize(modernStyle ? 4.2 : 4.5); doc.setFont('helvetica', 'normal')
      doc.setTextColor(modernStyle ? 195 : ar, modernStyle ? 180 : ag, modernStyle ? 148 : ab)
      doc.text(heLabel, x + w - 1.5, y + 5.8, { align: 'right', maxWidth: w * 0.46 })
    }
  }

  // Day-of-week header row
  const headY = y + HEADER_H + DAY_H - 1
  if (modernStyle) {
    doc.setFillColor(42, 58, 86)  // #2A3A56
    doc.rect(x, y + HEADER_H, w, DAY_H, 'F')
  } else if (glanceMode) {
    doc.setFillColor(232, 233, 235)  // #E8E9EB
    doc.rect(x, y + HEADER_H, w, DAY_H, 'F')
  }
  DAYS.forEach((d, i) => {
    const isSha = i === 6
    const colX = x + i * cellW
    const colW = isSha ? (x + w) - colX : cellW
    if (isSha) {
      if (modernStyle) {
        doc.setFillColor(255, 255, 255)
        doc.setGState(doc.GState({ opacity: 0.1 }))
        doc.rect(colX, y + HEADER_H, colW, DAY_H, 'F')
        doc.setGState(doc.GState({ opacity: 1.0 }))
      } else if (!glanceMode) {
        doc.setFillColor(188, 188, 196)
        doc.setGState(doc.GState({ opacity: 0.35 }))
        doc.rect(colX, y + HEADER_H, colW, DAY_H, 'F')
        doc.setGState(doc.GState({ opacity: 1.0 }))
      }
    }
    if (modernStyle) {
      doc.setTextColor(isSha ? 232 : 210, isSha ? 182 : 218, isSha ? 90 : 230)
    } else if (glanceMode) {
      doc.setTextColor(isSha ? 110 : 44, isSha ? 110 : 44, isSha ? 130 : 44)
    } else {
      doc.setTextColor(isSha ? 100 : 120, isSha ? 100 : 120, isSha ? 118 : 120)
    }
    doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
    doc.text(isSha ? shabbatLabel.slice(0, 3).toUpperCase() : d, colX + colW / 2, headY, { align: 'center' })
  })

  // Day cells
  days.forEach(date => {
    const dayNum = date.getDate()
    const dow = (startDow + dayNum - 1) % 7
    const weekRow = Math.floor((startDow + dayNum - 1) / 7)
    const cx = x + dow * cellW
    // For the last column (SHA), compute exact width to avoid floating-point gap at right edge
    const cw = dow === 6 ? (x + w) - cx : cellW
    const cy = y + HEADER_H + DAY_H + weekRow * cellH
    const dateKey = formatDateKey(date)
    const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
    const isSha = dow === 6
    const hebrewHolidayMini = getHolidayMap(settings.academicYear)[dateKey]

    // Weekend column tints
    if (glanceMode && (dow === 5 || dow === 6)) {
      doc.setFillColor(245, 245, 247)  // #F5F5F7 — subtle tint for FRI + SHA
      doc.rect(cx, cy, cw, cellH, 'F')
    } else if (isSha) {
      doc.setFillColor(modernStyle ? 253 : 188, modernStyle ? 248 : 188, modernStyle ? 238 : 196)
      doc.setGState(doc.GState({ opacity: modernStyle ? 0.30 : 0.28 }))
      doc.rect(cx, cy, cw, cellH, 'F')
      doc.setGState(doc.GState({ opacity: 1.0 }))
    }

    // In glance mode, determine if this cell is part of a multi-day run
    const isInRun = glanceMode && runDateKeys?.has(dateKey)
    const isRunLabelCell = glanceMode && runLabelDateKeys?.has(dateKey)
    const showLabel = cellH >= 5 && showEvents && dayEvs.length > 0 && (!isInRun || isRunLabelCell)

    // Event fill
    if (showEvents && dayEvs.length > 0) {
      const cat = categories.find(c => c.id === dayEvs[0].category)
      const baseColor = colorOverrides?.[cat?.id] || dayEvs[0].color || cat?.color || '#999'
      const [er, eg, eb] = hexToRgbLocal(baseColor)
      if (modernStyle) doc.setGState(doc.GState({ opacity: 0.85 }))
      doc.setFillColor(er, eg, eb)
      doc.roundedRect(cx + 0.2, cy + 0.2, cw - 0.4, cellH - 0.4, 0.4, 0.4, 'F')
      if (modernStyle) doc.setGState(doc.GState({ opacity: 1.0 }))
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(glanceMode ? 4.0 : modernStyle ? 4.2 : 3.5); doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + (glanceMode ? 1.4 : 1.2), cy + (glanceMode ? 2.6 : Math.min(3.5, cellH - 0.5)), { maxWidth: cw - 1.8 })
      if (showLabel) {
        const rawLabel = dayEvs[0].label || ''
        if (glanceMode) {
          doc.setFontSize(3.2); doc.setFont('helvetica', 'normal')
          const lines = doc.splitTextToSize(rawLabel, cw - 2.2)
          const hasTime = !!dayEvs[0].time
          const maxLines = Math.min(hasTime ? 1 : 2, Math.floor((cellH - 4.5) / 1.6))
          lines.slice(0, Math.max(1, maxLines)).forEach((line, li) => {
            doc.text(line, cx + 1.4, cy + 4.5 + li * 1.6)
          })
          if (hasTime) {
            doc.setFontSize(2.8); doc.setFont('helvetica', 'bold')
            doc.text(formatTime(dayEvs[0].time), cx + 1.4, cy + Math.min(6.1, cellH - 0.8))
          }
        } else {
          const displayLabel = rawLabel.length > 12 ? rawLabel.slice(0, 11) + '…' : rawLabel
          doc.setFontSize(2.8); doc.setFont('helvetica', 'normal')
          doc.text(displayLabel, cx + 1.2, cy + Math.min(6, cellH - 0.5), { maxWidth: cw - 1.5 })
        }
      }
    } else {
      if (glanceMode) {
        doc.setTextColor(44, 44, 44)  // #2C2C2C dark charcoal
      } else {
        doc.setTextColor(isSha ? 95 : 50, isSha ? 95 : 50, isSha ? 112 : 50)
      }
      doc.setFontSize(glanceMode ? 4.2 : modernStyle ? 4.5 : 3.8); doc.setFont('helvetica', (glanceMode || modernStyle || isSha) ? 'bold' : 'normal')
      doc.text(String(dayNum), cx + (glanceMode ? 1.4 : 1.2), cy + Math.min(3.5, cellH - 0.5), { maxWidth: cw - 1.8 })
    }

    doc.setDrawColor(glanceMode ? 218 : modernStyle ? 228 : 210, glanceMode ? 218 : modernStyle ? 230 : 215, glanceMode ? 218 : modernStyle ? 234 : 220)
    doc.setLineWidth(glanceMode ? 0.3 : modernStyle ? 0.25 : 0.15)
    doc.rect(cx, cy, cw, cellH, 'S')

    // Hebrew holiday badge — only when no user event (prevents double-labeling); skipped in modernStyle (clean minimal)
    if (!modernStyle && dayEvs.length === 0 && hebrewHolidayMini && settings.hebrewHolidayToggles?.[hebrewHolidayMini.group] !== false) {
      const hNameFull = settings.shabbatLabel === 'Shabbos' ? hebrewHolidayMini.ashkenaz : hebrewHolidayMini.sephardi
      const hNameMini = MINI_HOLIDAY_ABBREV[hNameFull] || (hNameFull.length > 9 ? hNameFull.slice(0, 8) + '.' : hNameFull)
      doc.setFontSize(2.5); doc.setFont('helvetica', 'normal')
      doc.setTextColor(160, 100, 20)
      doc.text(hNameMini, cx + cw - 0.5, cy + cellH - 0.6, { align: 'right', maxWidth: cw - 1 })
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
  const LEG_H = 2   // legend lives in the 12th grid slot, not the bottom strip
  // Modern desaturated color palette — single source of truth for both grid cells and legend pills
  const minimalColorOverrides = {
    'no-school':       '#E05C5C',
    'early-dismissal': '#E8956D',
    'staff':           '#6B8CBA',
    'school-event':    '#7B6FBF',
    'chanukah':        '#D4A843',
    'hebrew-only':     '#5AA87A',
  }
  const showBottomPanel = settings.eventsPanel === 'bottom'
  const maxEvMin = showBottomPanel ? 0 : computeMaxEventsPerMonth(events, settings.academicYear)
  const NOTES_H = showBottomPanel ? 0 : Math.min(Math.max(8, maxEvMin * 2.2 + 2), 22)
  const bpPanelWMin = PAGE_W - MARGIN * 2 - 2
  // Allow the panel to grow until month cells are at least 28mm — prevents September's
  // large groupH from triggering the skip guard and silently hiding entire months.
  const MIN_MONTH_H = 28
  const maxPanelHMin = PAGE_H - HEADER_H - 3 - MARGIN - LEG_H - 2 - 3 * (MIN_MONTH_H + 3)  // ≈ 88mm
  const bottomLayoutMin = showBottomPanel ? bpComputeLayout(doc, events, settings.academicYear, bpPanelWMin, maxPanelHMin, true) : null
  const BOTTOM_H = showBottomPanel ? (bottomLayoutMin?.panelH || 26) : 0
  const GRID_W = PAGE_W - MARGIN * 2
  const MONTH_W = (GRID_W / 4) - 2.5
  const MONTH_H = (PAGE_H - HEADER_H - 3 - MARGIN - LEG_H - BOTTOM_H - (showBottomPanel ? 2 : 0)) / 3 - NOTES_H - 3
  const catMap = {}; categories.forEach(c => { catMap[c.id] = c })

  // Pre-compute circular logo
  let circLogoMin = null
  if (schoolInfo.logo) { try { circLogoMin = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  // White page
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  if (circLogoMin) doc.addImage(circLogoMin, 'PNG', MARGIN, 1, 11, 11)
  // Year label — same weight/size as title, right-aligned
  const yearLabel = settings.academicYear || '2026-2027'
  doc.setFontSize(9); doc.setFont(titleFont, 'bold'); doc.setTextColor(pr, pg, pb)
  doc.text(yearLabel, PAGE_W - MARGIN, 9, { align: 'right' })
  // Title — reserve space for logo and year label
  const titleStartX = circLogoMin ? MARGIN + 13 : MARGIN
  const yearLabelW = doc.getTextWidth(yearLabel) + 3
  doc.setTextColor(pr, pg, pb)
  doc.setFontSize(9); doc.setFont(titleFont, 'bold')
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', titleStartX, 9, { maxWidth: PAGE_W - titleStartX - MARGIN - yearLabelW })
  // 3pt accent bar anchoring header — accent color for visual warmth
  doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 1.05, PAGE_W, 1.05, 'F')

  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 3
  const MONTHS_MIN = getAcademicMonths(settings.academicYear)
  const rowStep = MONTH_H + (showBottomPanel ? 0 : NOTES_H) + 3

  // Draw the 11 month cards (indices 0–10)
  MONTHS_MIN.forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + col * (MONTH_W + 3)
    const y = startY + row * rowStep
    const cardH = MONTH_H + NOTES_H
    // Subtle drop-shadow simulation
    doc.setFillColor(190, 198, 212)
    doc.setGState(doc.GState({ opacity: 0.3 }))
    doc.roundedRect(x + 0.6, y + 0.6, MONTH_W, cardH, 1.5, 1.5, 'F')
    doc.setGState(doc.GState({ opacity: 1.0 }))
    // Card background
    doc.setFillColor(247, 249, 252)
    doc.roundedRect(x, y, MONTH_W, cardH, 1.5, 1.5, 'F')
    drawMiniMonth(doc, { year, month }, events, categories, settings, {
      x, y, w: MONTH_W, h: MONTH_H, pr, pg, pb, ar, ag, ab, titleFont, shabbatLabel,
      modernStyle: true, colorOverrides: minimalColorOverrides,
    })
    if (!showBottomPanel) {
      drawNotesStrip(doc, events, catMap, x, y + MONTH_H, MONTH_W, NOTES_H, year, month, { modernStyle: true, colorOverrides: minimalColorOverrides })
    }
  })

  // ── Legend card — 12th slot (row 2, col 3, always empty) ─────────────────
  {
    const legCardX = MARGIN + 3 * (MONTH_W + 3)
    const legCardY = startY + 2 * rowStep
    const legCardW = MONTH_W
    const legCardH = MONTH_H + NOTES_H
    const LEG_HEADER_H = 8

    // Card shadow + background (same style as month cards)
    doc.setFillColor(190, 198, 212)
    doc.setGState(doc.GState({ opacity: 0.3 }))
    doc.roundedRect(legCardX + 0.6, legCardY + 0.6, legCardW, legCardH, 1.5, 1.5, 'F')
    doc.setGState(doc.GState({ opacity: 1.0 }))
    doc.setFillColor(247, 249, 252)
    doc.roundedRect(legCardX, legCardY, legCardW, legCardH, 1.5, 1.5, 'F')

    // Header bar — same dark navy gradient as month headers
    const steps = Math.ceil(legCardW)
    const r1 = 26, g1 = 46, b1 = 74, r2 = 36, g2 = 61, b2 = 95
    for (let s = 0; s < steps; s++) {
      const t = s / Math.max(steps - 1, 1)
      doc.setFillColor(Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t))
      doc.rect(legCardX + (s / steps) * legCardW, legCardY, legCardW / steps + 0.1, LEG_HEADER_H, 'F')
    }
    // Accent underline on header
    doc.setFillColor(ar, ag, ab)
    doc.rect(legCardX, legCardY + LEG_HEADER_H - 1.5, legCardW, 1.5, 'F')
    // "LEGEND" title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7); doc.setFont(titleFont, 'bold')
    doc.text('Legend', legCardX + 2, legCardY + 5.8)

    // Category rows — 2-column layout, row height adapts to available space
    const visibleCats = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
    const halfLen = Math.ceil(visibleCats.length / 2)
    const colW2 = legCardW / 2
    const availH = legCardH - LEG_HEADER_H - 4   // usable height below header
    // Scale rowH to ensure all rows fit; cap at 7mm, floor at 4mm
    const rowH2 = Math.min(7, Math.max(4, availH / halfLen))
    const swatchH = Math.min(4.5, rowH2 - 0.8)
    const fontSize = rowH2 >= 6 ? 5.5 : 5
    const itemStartY = legCardY + LEG_HEADER_H + 2.5

    doc.setFontSize(fontSize); doc.setFont('helvetica', 'bold')
    visibleCats.forEach((cat, i) => {
      const lcol = i < halfLen ? 0 : 1
      const lrow = i < halfLen ? i : i - halfLen
      const ix = legCardX + lcol * colW2 + 3
      const iy = itemStartY + lrow * rowH2
      if (iy + swatchH > legCardY + legCardH - 1) return   // clip guard
      const [cr, cg, cb] = hexToRgbLocal(minimalColorOverrides[cat.id] || cat.color || '#999')
      doc.setFillColor(cr, cg, cb)
      doc.roundedRect(ix, iy, 4.5, swatchH, 0.6, 0.6, 'F')
      doc.setTextColor(45, 55, 72)
      doc.text(cat.name, ix + 6.5, iy + swatchH * 0.72, { maxWidth: colW2 - 10 })
    })
  }

  // ── Bottom events panel ───────────────────────────────────────────────────
  if (showBottomPanel && bottomLayoutMin) {
    const panelY = startY + 3 * rowStep + 2   // 2mm gap between grid and panel
    drawBottomEventsPanel(doc, categories, panelY, PAGE_W, MARGIN, 0, bottomLayoutMin, settings)
  }

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
      let evY1 = cy + 12
      dayEvs.slice(0, 3).forEach((ev) => {
        const cat = categories.find(c => c.id === ev.category)
        const [er, eg, eb] = hexToRgbLocal(ev.color || cat?.color || '#999')
        const hasTime = !!ev.time
        const boxH = hasTime ? 9 : 6
        doc.setFillColor(er, eg, eb)
        doc.roundedRect(cx + 1.5, evY1, cellW - 3, boxH, 0.8, 0.8, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
        doc.text(ev.label, cx + 3, evY1 + 4.5, { maxWidth: cellW - 5 })
        if (hasTime) {
          doc.setFontSize(3.5); doc.setFont('helvetica', 'normal')
          doc.text(formatTime(ev.time), cx + 3, evY1 + 7.2, { maxWidth: cellW - 5 })
        }
        evY1 += boxH + 2
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
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 7
  const COLS = 4, ROWS = 3
  const COL_GAP = 3.5, ROW_GAP = 3.5
  const HEADER_H = 14
  const LEGEND_H = 10
  const MONTH_W = (PAGE_W - MARGIN * 2 - (COLS - 1) * COL_GAP) / COLS
  const MONTH_H = (PAGE_H - HEADER_H - 3 - (LEGEND_H + 2) - (ROWS - 1) * ROW_GAP) / ROWS

  // Pre-compute circular logo
  let circLogoGlance = null
  if (schoolInfo.logo) { try { circLogoGlance = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  // Page header
  doc.setFillColor(pr, pg, pb); doc.rect(0, 0, PAGE_W, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab); doc.rect(0, HEADER_H - 2, PAGE_W, 2, 'F')
  if (circLogoGlance) doc.addImage(circLogoGlance, 'PNG', MARGIN, 2, 10, 10)
  const glanceYearStr = `Year at a Glance  ·  ${settings.academicYear || '2026-2027'}`
  doc.setTextColor(ar, ag, ab); doc.setFontSize(8); doc.setFont(titleFont, 'normal')
  doc.text(glanceYearStr, PAGE_W - MARGIN - 2, 9, { align: 'right' })
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont(titleFont, 'bold')
  const glanceTitleX = circLogoGlance ? MARGIN + 13 : MARGIN + 2
  const glanceYearW = doc.getTextWidth(glanceYearStr)
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', glanceTitleX, 9, {
    maxWidth: PAGE_W - glanceTitleX - glanceYearW - MARGIN - 4
  })

  if (settings.draftWatermark) {
    doc.setTextColor(200, 50, 50); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.18 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 3
  const glanceColorOverrides = {
    'no-school':       '#D9534F',
    'early-dismissal': '#E8A838',
    'staff':           '#7B68B5',
    'school-event':    '#3D7EBF',
    'chanukah':        '#E07B39',
    'hebrew-only':     '#4A9E6F',
  }
  getAcademicMonths(settings.academicYear).forEach(({ year, month }, idx) => {
    const col = idx % COLS; const row = Math.floor(idx / COLS)
    const mx = MARGIN + col * (MONTH_W + COL_GAP)
    const my = startY + row * (MONTH_H + ROW_GAP)
    drawMiniMonth(doc, { year, month }, events, categories, settings, {
      x: mx, y: my, w: MONTH_W, h: MONTH_H, pr, pg, pb, ar, ag, ab, titleFont, shabbatLabel,
      glanceMode: true, colorOverrides: glanceColorOverrides,
    })
  })

  // 12th slot — school contact block (idx 11, col 3 row 2)
  const infoX = MARGIN + 3 * (MONTH_W + COL_GAP)
  const infoY = startY + 2 * (MONTH_H + ROW_GAP)
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(infoX, infoY, MONTH_W, MONTH_H, 1.5, 1.5, 'F')
  doc.setFillColor(ar, ag, ab)
  doc.rect(infoX, infoY + MONTH_H - 2.5, MONTH_W, 2.5, 'F')
  const infoMidX = infoX + MONTH_W / 2
  let infoTy = infoY
  if (circLogoGlance) {
    const logoSz = Math.min(MONTH_W * 0.32, MONTH_H * 0.32)
    doc.addImage(circLogoGlance, 'PNG', infoMidX - logoSz / 2, infoY + 5, logoSz, logoSz)
    infoTy = infoY + 5 + logoSz + 5
  } else {
    infoTy = infoY + MONTH_H * 0.22
  }
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont(titleFont, 'bold')
  const schoolDisplayName = settings.calendarTitle || schoolInfo.name || ''
  const nameLines = doc.splitTextToSize(schoolDisplayName, MONTH_W - 8)
  nameLines.slice(0, 2).forEach(line => {
    doc.text(line, infoMidX, infoTy, { align: 'center' }); infoTy += 5
  })
  if (schoolInfo.address) {
    doc.setTextColor(ar, ag, ab); doc.setFontSize(5); doc.setFont('helvetica', 'normal')
    infoTy += 1
    const addrLines = doc.splitTextToSize(schoolInfo.address, MONTH_W - 8)
    addrLines.slice(0, 2).forEach(line => {
      doc.text(line, infoMidX, infoTy, { align: 'center' }); infoTy += 3.5
    })
  }
  if (schoolInfo.phone) {
    doc.setTextColor(ar, ag, ab); doc.setFontSize(4.8); doc.setFont('helvetica', 'normal')
    doc.text(schoolInfo.phone, infoMidX, infoTy, { align: 'center' }); infoTy += 3.5
  }
  if (schoolInfo.website) {
    doc.setTextColor(ar, ag, ab); doc.setFontSize(4.8); doc.setFont('helvetica', 'italic')
    doc.text(schoolInfo.website, infoMidX, infoY + MONTH_H - 6, { align: 'center' })
  }

  // Legend — fixed-column grid so all categories always fit
  const legAreaY = PAGE_H - LEGEND_H - 1
  doc.setFillColor(248, 249, 252); doc.rect(0, legAreaY, PAGE_W, LEGEND_H + 1, 'F')
  doc.setDrawColor(210, 210, 215); doc.setLineWidth(0.3); doc.line(0, legAreaY, PAGE_W, legAreaY)
  {
    const visCats = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
    if (visCats.length > 0) {
      // Pack into at most 2 rows; derive column count from category count
      const numCols = Math.max(3, Math.ceil(visCats.length / 2))
      const numRows = Math.ceil(visCats.length / numCols)
      const legW    = PAGE_W - MARGIN * 2
      const colW    = legW / numCols
      const SW = 4.5, SH = 2.8, SR = 0.4   // swatch dimensions
      const rowH = (LEGEND_H - 2) / numRows
      visCats.slice(0, numCols * 2).forEach((cat, i) => {
        const col   = i % numCols
        const row   = Math.floor(i / numCols)
        const itemX = MARGIN + col * colW
        const itemY = legAreaY + 1.5 + row * rowH
        const [cr, cg, cb] = hexToRgbLocal(glanceColorOverrides[cat.id] || cat.color || '#999')
        doc.setFillColor(cr, cg, cb)
        doc.roundedRect(itemX, itemY, SW, SH, SR, SR, 'F')
        doc.setTextColor(50, 50, 50); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal')
        doc.text(cat.name, itemX + SW + 1.5, itemY + SH * 0.82, { maxWidth: colW - SW - 3 })
      })
    }
  }

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'Calendar').replace(/\s+/g, '-')}-YearAtAGlance.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// STYLE 5: DARK ELEGANT — dark navy background, accent headers
// ────────────────────────────────────────────────────────────────────────────
// ── Dark-Elegant helpers (private to this style) ─────────────────────────────

// Abbreviate event labels to fit inside small calendar grid cells.
// Longer-match entries MUST come before shorter substrings (e.g. "chanukah dismissal" before "chanukah").
function deAbbrevLabel(label) {
  const lower = label.toLowerCase()
  const ABBREVS = [
    // ── Exact / priority matches (longer strings first) ──────────────────────
    ['preschool first full day', 'Pre-K'],
    ['preschool half day',       'Pre-K'],
    ['back to school night',     'BTSN'],
    ['erev rosh hashana',        'Erev R.H.'],
    ['erev rosh hashanah',       'Erev R.H.'],
    ['rosh hashana',             'R. Hashana'],
    ['rosh hashanah',            'R. Hashana'],
    ['tzom gedalya',             'Tzom Ged.'],
    ['tzom gedalyah',            'Tzom Ged.'],
    ['yom kippur',               'Yom Kip.'],
    ['sukkos break',             'Sukkos Brk'],
    ['sukkot break',             'Sukkos Brk'],
    ['school resumes',           'Resumes'],
    ['winter break',             'Winter Brk'],
    ['winter recess',            'Winter Brk'],
    ['pesach break',             'Pesach Brk'],
    ['chanukah dismissal',       'Chan. Dis.'],
    ['chanukah',                 'Chanukah'],
    ['new year\'s hebrew only',  "New Year's"],
    ['thanksgiving hebrew only', 'Thanks.'],
    ['taanis esther',            'Taanis Est.'],
    ['shushan purim',            'Shush. P.'],
    ['erev shavuos',             'Erev Shav.'],
    ['erev shavuot',             'Erev Shav.'],
    ['graduation',               'Graduation'],
    ['last day',                 'Last Day'],
    // ── General patterns ─────────────────────────────────────────────────────
    ['in-service',               'In-Svc'],
    ['professional development', 'Prof. Dev.'],
    ['shemini atzeret',          'Sh. Atz.'],
    ['simchat torah',            'Sim. Torah'],
    ['sukkot',                   'Sukkot'],
    ['purim',                    'Purim'],
    ['pesach',                   'Pesach'],
    ['shavuot',                  'Shavuot'],
    ['spring break',             'Spring Brk'],
    ['spring recess',            'Spring Brk'],
    ['parent teacher',           'PT Conf.'],
    ['no school',                'No School'],
    ['early dismissal',          'Early Dis.'],
    ['3:45 dismissal',           '3:45 Dis.'],
  ]
  for (const [key, abbr] of ABBREVS) { if (lower.includes(key)) return abbr }
  if (label.length > 11) return label.slice(0, 10) + '\u2026'
  return label
}

// Dark-themed notes strip with proper contrast and increased line spacing
function deDarkNotesStrip(doc, events, catMap, x, y, w, h, year, month, colorOverrides) {
  const CARD = [24, 32, 58], TEXC = [203, 213, 224], GRID_LINE = [46, 64, 96]
  doc.setFillColor(...CARD); doc.rect(x, y, w, h, 'F')
  doc.setDrawColor(...GRID_LINE); doc.setLineWidth(0.5); doc.line(x, y, x + w, y)
  const days = getDaysInMonth(year, month)
  const notesEvents = {}
  days.forEach(date => {
    const dateKey = formatDateKey(date)
    ;(events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh').forEach(ev => {
      const key = `${ev.category}::${ev.label}`
      if (!notesEvents[key]) notesEvents[key] = { ev, dates: [] }
      notesEvents[key].dates.push(dateKey)
    })
  })
  let lineY = y + 3.2; const lineSpacing = 2.6; const maxY = y + h - 1
  doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
  for (const { ev, dates } of Object.values(notesEvents)) {
    if (lineY > maxY) break
    const cat = catMap[ev.category]
    const colorHex = colorOverrides[ev.category] || ev.color || cat?.color || '#999'
    const [r, g, b] = hexToRgbLocal(colorHex)
    doc.setFillColor(r, g, b); doc.circle(x + 1.3, lineY - 0.7, 0.75, 'F')
    const groups = groupConsecutiveDates([...dates].sort())
    const rangeStr = formatRangeGroups(groups)
    doc.setTextColor(...TEXC)
    doc.text(`${rangeStr} | ${ev.label}`, x + 3, lineY, { maxWidth: w - 3.8 })
    lineY += lineSpacing + 0.5
  }
}

// Dark-mode sidebar block renderer (gold headers, pill swatches, gold website link)
function deDarkSidebarBlock(doc, blockId, startY, { sbX, sbCx, SIDEBAR_W, GOLD, TEXC, schoolInfo, categories, DE_COLORS }) {
  const [ar, ag, ab] = GOLD; const [tr, tg, tb] = TEXC
  let y = startY; const ruleW = SIDEBAR_W * 0.8
  switch (blockId) {
    case 'hours': {
      const hourLines = (schoolInfo.hours || '').split('\n').filter(l => l.trim())
      if (!hourLines.length) return y
      doc.setTextColor(ar, ag, ab); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text('SCHOOL HOURS', sbCx, y, { align: 'center' })
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbCx - ruleW / 2, y + 2, sbCx + ruleW / 2, y + 2)
      y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(tr, tg, tb)
      hourLines.forEach((line, i) => doc.text(line.trim(), sbCx, y + i * 5.5, { align: 'center', maxWidth: SIDEBAR_W - 4 }))
      y += hourLines.length * 5.5 + 6
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.4)
      doc.line(sbX + 4, y, sbX + SIDEBAR_W - 4, y)
      return y + 7
    }
    case 'legend': {
      const visibleCats = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
      if (!visibleCats.length) return y
      doc.setTextColor(ar, ag, ab); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text('LEGEND', sbCx, y, { align: 'center' })
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.5)
      doc.line(sbCx - ruleW / 2, y + 2, sbCx + ruleW / 2, y + 2)
      y += 6
      visibleCats.forEach((cat) => {
        const colorHex = DE_COLORS[cat.id] || cat.color || '#999'
        const [r, g, b] = hexToRgbLocal(colorHex)
        // 12×12px swatch ≈ 3.2×3.2mm, 3px radius corners
        doc.setFillColor(r, g, b); doc.roundedRect(sbX + 3, y - 3.0, 3.2, 3.2, 0.8, 0.8, 'F')
        doc.setTextColor(tr, tg, tb); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
        const labelLines = doc.splitTextToSize(cat.name, SIDEBAR_W - 10)
        labelLines.slice(0, 2).forEach((line, li) => doc.text(line, sbX + 7.5, y - 0.3 + li * 4.8))
        y += Math.max(6.5, labelLines.slice(0, 2).length * 4.8 + 1.5)
      })
      y += 4
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.4)
      doc.line(sbX + 4, y, sbX + SIDEBAR_W - 4, y)
      return y + 7
    }
    case 'otherInfo': {
      if (!schoolInfo.otherInfo) return y
      const lines = doc.splitTextToSize(schoolInfo.otherInfo, SIDEBAR_W - 6).slice(0, 4)
      doc.setFontSize(4.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(tr, tg, tb)
      lines.forEach((line, i) => doc.text(line, sbCx, y + i * 5, { align: 'center' }))
      y += lines.length * 5 + 4
      doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.4)
      doc.line(sbX + 4, y, sbX + SIDEBAR_W - 4, y)
      return y + 7
    }
    case 'contact': {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(tr, tg, tb)
      if (schoolInfo.address) {
        const addrLines = doc.splitTextToSize(schoolInfo.address, SIDEBAR_W - 6)
        addrLines.forEach((line, i) => doc.text(line, sbCx, y + i * 4.5, { align: 'center' }))
        y += addrLines.length * 4.5 + 1
      }
      if (schoolInfo.phone) { doc.text(`Tel: ${schoolInfo.phone}`, sbCx, y, { align: 'center' }); y += 5 }
      if (schoolInfo.fax) { doc.text(`Fax: ${schoolInfo.fax}`, sbCx, y, { align: 'center' }); y += 5 }
      if (schoolInfo.email) { doc.text(schoolInfo.email, sbCx, y, { align: 'center', maxWidth: SIDEBAR_W - 6 }); y += 5 }
      if (schoolInfo.website) {
        // Website URL in gold (only item styled this way per design spec)
        doc.setTextColor(ar, ag, ab); doc.setFont('helvetica', 'bold')
        doc.text(schoolInfo.website, sbCx, y, { align: 'center', maxWidth: SIDEBAR_W - 6 })
      }
      return y
    }
    default: return y
  }
}

async function exportDarkElegant(state, { preview, theme, doc, titleFont, shabbatLabel }) {
  const { events, categories, schoolInfo, settings } = state

  // ── Color palette ──────────────────────────────────────────────────────────
  const GOLD      = [201, 168, 76]   // #C9A84C — accent gold
  const BG        = [15, 20, 38]     // dark navy page background
  const CARD      = [24, 32, 58]     // month block background
  const PANEL_BG  = [26, 43, 69]     // #1A2B45 — sidebar (slightly lighter than CARD)
  const TEXC      = [203, 213, 224]  // #CBD5E0 — body text
  const GRID_LINE = [46, 64, 96]     // #2E4060 — hairline grid
  const SHA_TINT  = [20, 27, 50]     // subtle warm tint for entire SHA column
  const CHARCOAL  = [58, 58, 58]     // #3A3A3A — Hebrew range secondary text

  // Refined category colors optimised for dark background
  const DE_COLORS = {
    'no-school':       '#C0392B',
    'early-dismissal': '#D4872A',
    'staff':           '#7B5EA7',
    'school-event':    '#2E7FBF',
    'chanukah':        '#C4622D',
    'hebrew-only':     '#2A8C6E',
  }

  const [ar, ag, ab] = GOLD
  const PAGE_W = 297, PAGE_H = 210, MARGIN = 8, SIDEBAR_W = 50
  const GRID_W = PAGE_W - MARGIN * 2 - SIDEBAR_W          // ~231mm
  const GAP = 3                                            // gap between month columns
  const MONTH_W = (GRID_W - 3 * GAP) / 4                  // ~55.5mm per month
  const HEADER_H = 20
  const HDR_H = 9                                          // gold month-header band height
  const GRID_OVERHEAD = 13                                 // from month-y to first cell row
  const ROW_GAP = 3                                        // vertical gap between rows

  const showBottomPanel = settings.eventsPanel === 'bottom'
  const NOTES_H = showBottomPanel ? 0 : 10                 // fixed 10mm strip — keeps cells taller
  const bpPanelWDE = PAGE_W - MARGIN * 2 - SIDEBAR_W - 2
  // includeEmpty=true ensures all 11 academic months appear in the panel
  const bottomLayoutDE = showBottomPanel ? bpComputeLayout(doc, events, settings.academicYear, bpPanelWDE, 85, true) : null
  const BOTTOM_H = showBottomPanel ? (bottomLayoutDE?.panelH || 26) : 0
  const catMapDE = {}; categories.forEach(c => { catMapDE[c.id] = c })

  // Per-row dynamic heights: high-density rows (e.g. September) get proportionally more space
  const deMonths = getAcademicMonths(settings.academicYear)
  const monthMaxEv = deMonths.map(({ year, month }) => {
    const mDays = getDaysInMonth(year, month); let mx = 0
    mDays.forEach(date => {
      const cnt = (events[formatDateKey(date)] || []).filter(e => e.category !== 'rosh-chodesh').length
      if (cnt > mx) mx = cnt
    })
    return mx
  })
  const rowMaxEv = [0, 1, 2].map(r => Math.max(0, ...monthMaxEv.slice(r * 4, r * 4 + 4)))
  // Budget-neutral redistribution: dense rows gain height, sparse rows give it up
  const baseMH = (PAGE_H - HEADER_H - MARGIN - 6 - BOTTOM_H - 2 * ROW_GAP) / 3 - NOTES_H
  const rowBonus = rowMaxEv.map(mx => mx > 3 ? 3.5 : mx > 1 ? 1.5 : 0)
  const totalBonus = rowBonus.reduce((s, b) => s + b, 0)
  const rowMonthH = rowBonus.map(b => Math.max(22, baseMH + b - totalBonus / 3))
  const rowCellH = rowMonthH.map(mh => Math.max(4.0, (mh - GRID_OVERHEAD) / 6))

  // Pre-compute circular logo
  let circLogoDark = null
  if (schoolInfo.logo) { try { circLogoDark = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle') } catch {} }

  // ── Page background ────────────────────────────────────────────────────────
  doc.setFillColor(...BG); doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  // ── Gold left accent bar ───────────────────────────────────────────────────
  doc.setFillColor(...GOLD); doc.rect(0, 0, 4, PAGE_H, 'F')

  // ── Header card ───────────────────────────────────────────────────────────
  doc.setFillColor(...CARD); doc.rect(4, 0, PAGE_W - 4, HEADER_H, 'F')

  // Logo
  if (circLogoDark) doc.addImage(circLogoDark, 'PNG', MARGIN + 2, 3.5, 13, 13)

  // School name (gold, larger than before)
  const darkNameX = circLogoDark ? MARGIN + 17 : MARGIN + 4
  doc.setTextColor(...GOLD); doc.setFontSize(12); doc.setFont(titleFont, 'bold')
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', darkNameX, 12)

  // Academic year — full text, right-aligned, 7pt to guarantee it always fits
  const acYear = (settings.academicYear || '2026-2027').replace('-', '\u2013')
  doc.setTextColor(...TEXC); doc.setFontSize(7); doc.setFont(titleFont, 'normal')
  doc.text(`Academic Year ${acYear}`, PAGE_W - MARGIN - 3, 16, { align: 'right' })

  // Gold horizontal rule below header
  doc.setDrawColor(...GOLD); doc.setLineWidth(1)
  doc.line(4, HEADER_H, PAGE_W, HEADER_H)

  if (settings.draftWatermark) {
    doc.setTextColor(220, 80, 80); doc.setFontSize(72); doc.setFont('helvetica', 'bold')
    doc.setGState(doc.GState({ opacity: 0.12 }))
    doc.text('DRAFT', PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 35 })
    doc.setGState(doc.GState({ opacity: 1.0 }))
  }

  const startY = HEADER_H + 2.5
  const rowStartY = [
    startY,
    startY + rowMonthH[0] + NOTES_H + ROW_GAP,
    startY + rowMonthH[0] + NOTES_H + ROW_GAP + rowMonthH[1] + NOTES_H + ROW_GAP,
  ]

  deMonths.forEach(({ year, month }, idx) => {
    const col = idx % 4; const row = Math.floor(idx / 4)
    const x = MARGIN + col * (MONTH_W + GAP)
    const y = rowStartY[row]
    const MONTH_H = rowMonthH[row]
    const cellH = rowCellH[row]
    const cellW = MONTH_W / 7

    // ── Month card container ──
    doc.setFillColor(...CARD); doc.roundedRect(x, y, MONTH_W, MONTH_H, 2.5, 2.5, 'F')

    // ── Gold header band — rounded top corners only ──
    doc.setFillColor(...GOLD)
    doc.roundedRect(x, y, MONTH_W, HDR_H, 2.5, 2.5, 'F')
    doc.rect(x, y + 2.5, MONTH_W, HDR_H - 2.5, 'F')  // flatten bottom corners

    // Month name — 8pt bold for stronger hierarchy
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    doc.setTextColor(...BG); doc.setFontSize(8); doc.setFont(titleFont, 'bold')
    doc.text(`${mName} ${year}`, x + 2.5, y + 6.5)

    // Hebrew month range — italic, lighter, clearly secondary
    const hebrewRange = getHebrewMonthLabel(year, month)
    if (hebrewRange) {
      doc.setTextColor(45, 45, 45); doc.setFontSize(4.5); doc.setFont('helvetica', 'italic')
      doc.text(hebrewRange, x + MONTH_W - 2.5, y + 7.2, { align: 'right' })
    }

    // ── Day-of-week column headers — 4pt, consistent center alignment per column ──
    const headY = y + HDR_H + 2.5
    DAYS.forEach((d, i) => {
      const isSha = i === 6
      doc.setTextColor(isSha ? ar : 140, isSha ? ag : 155, isSha ? ab : 185)
      doc.setFontSize(4); doc.setFont('helvetica', 'bold')
      doc.text(isSha ? shabbatLabel.slice(0, 3).toUpperCase() : d, x + i * cellW + cellW / 2, headY, { align: 'center' })
    })

    // ── Calendar grid ──
    const days = getDaysInMonth(year, month)
    const startDow = getFirstDayOfWeek(year, month)
    const gridTop = y + GRID_OVERHEAD

    // SHA column background tint
    doc.setFillColor(...SHA_TINT)
    doc.rect(x + 6 * cellW, gridTop, cellW, 6 * cellH, 'F')

    // Hairline grid lines
    doc.setDrawColor(...GRID_LINE); doc.setLineWidth(0.3)
    for (let r = 0; r <= 6; r++) doc.line(x, gridTop + r * cellH, x + MONTH_W, gridTop + r * cellH)
    for (let c = 0; c <= 7; c++) doc.line(x + c * cellW, gridTop, x + c * cellW, gridTop + 6 * cellH)

    days.forEach(date => {
      const dayNum = date.getDate()
      const dow = (startDow + dayNum - 1) % 7
      const weekRow = Math.floor((startDow + dayNum - 1) / 7)
      const cx = x + dow * cellW
      const cy = gridTop + weekRow * cellH
      const dateKey = formatDateKey(date)
      const dayEvs = (events[dateKey] || []).filter(e => e.category !== 'rosh-chodesh')
      const isSha = dow === 6

      // Day number — always on top, gold for SHA, muted light for weekdays
      doc.setFontSize(3.8); doc.setFont('helvetica', 'bold')
      doc.setTextColor(isSha ? ar : TEXC[0], isSha ? ag : TEXC[1], isSha ? ab : TEXC[2])
      doc.text(String(dayNum), cx + 1.2, cy + 3.0)

      if (dayEvs.length === 0) return

      // Thin separator (~30% gold opacity) between date number and badge area
      doc.setDrawColor(ar, ag, ab)
      doc.setGState(doc.GState({ opacity: 0.3 }))
      doc.setLineWidth(0.25)
      doc.line(cx + 0.4, cy + 3.6, cx + cellW - 0.4, cy + 3.6)
      doc.setGState(doc.GState({ opacity: 1.0 }))

      // Badge area: from separator to cell bottom
      const badgeTop = cy + 4.1
      const badgeBot = cy + cellH - 0.3
      const badgeAreaH = badgeBot - badgeTop

      // Fit as many badges as space allows (up to 3), always show at least 1
      const MIN_BADGE_H = 2.0
      const BADGE_GAP   = 0.3
      const MORE_H      = 2.0  // height reserved for "+N more" indicator
      let maxVis = 0
      for (let k = 1; k <= Math.min(dayEvs.length, 3); k++) {
        const needed = k * MIN_BADGE_H + (k - 1) * BADGE_GAP + (k < dayEvs.length ? MORE_H + 0.3 : 0)
        if (needed <= badgeAreaH) maxVis = k
        else break
      }
      if (maxVis === 0) maxVis = 1

      const hidden = dayEvs.length - maxVis
      const totalBadgeH = badgeAreaH - (hidden > 0 ? MORE_H + 0.3 : 0)
      const singleH = Math.max(MIN_BADGE_H, (totalBadgeH - (maxVis - 1) * BADGE_GAP) / maxVis)
      // Badge font size proportional to badge height, capped 3.5–5pt
      const badgeFS = Math.max(3.5, Math.min(5, singleH * 0.58 / 0.3527))

      dayEvs.slice(0, maxVis).forEach((ev, bi) => {
        const cat = categories.find(c => c.id === ev.category)
        const colorHex = DE_COLORS[ev.category] || ev.color || cat?.color || '#888'
        const [er, eg, eb] = hexToRgbLocal(colorHex)
        const by = badgeTop + bi * (singleH + BADGE_GAP)
        const bh = Math.min(singleH, badgeBot - by - (hidden > 0 ? MORE_H + 0.3 : 0))
        if (bh < 1.2) return
        doc.setFillColor(er, eg, eb)
        doc.roundedRect(cx + 0.4, by, cellW - 0.8, bh, 1.0, 1.0, 'F')  // 1mm ≈ 3px radius
        const abbr = deAbbrevLabel(ev.label || '')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(badgeFS); doc.setFont('helvetica', 'bold')
        doc.text(abbr, cx + cellW / 2, by + bh * 0.68, { align: 'center', maxWidth: cellW - 1.0 })
      })

      // "+N more" indicator — small italic, never silently drops events
      if (hidden > 0) {
        doc.setFontSize(3.2); doc.setFont('helvetica', 'italic')
        doc.setTextColor(170, 185, 210)
        doc.text(`+${hidden} more`, cx + cellW - 0.5, badgeBot - 0.2, { align: 'right' })
      }
    })

    if (!showBottomPanel) {
      deDarkNotesStrip(doc, events, catMapDE, x, y + MONTH_H, MONTH_W, NOTES_H, year, month, DE_COLORS)
    }
  })

  if (showBottomPanel && bottomLayoutDE) {
    const panelY = rowStartY[2] + rowMonthH[2] + ROW_GAP
    // Gold rule separating calendar grid from events panel
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.7)
    doc.line(MARGIN, panelY - 1.5, PAGE_W - MARGIN - SIDEBAR_W, panelY - 1.5)
    drawBottomEventsPanel(doc, categories, panelY, PAGE_W, MARGIN, SIDEBAR_W, bottomLayoutDE, settings, {
      titleColor:     GOLD,
      colBorderColor: GOLD,
      colBorderWidth: 0.5,
      colBorderAll:   true,
    })
  }

  // ── Sidebar panel ─────────────────────────────────────────────────────────
  const sbX = PAGE_W - MARGIN - SIDEBAR_W
  const sbCx = sbX + SIDEBAR_W / 2
  const sbTop = HEADER_H + 1.5
  const sbH = PAGE_H - sbTop - MARGIN
  // Slightly lighter background to distinguish from CARD
  doc.setFillColor(...PANEL_BG); doc.rect(sbX, sbTop, SIDEBAR_W, sbH, 'F')
  // Gold left border (2pt weight)
  doc.setDrawColor(...GOLD); doc.setLineWidth(2)
  doc.line(sbX, sbTop, sbX, sbTop + sbH)

  const deBlocks = (settings.sidebarBlocks || DEFAULT_SIDEBAR_BLOCKS).filter(b => b.visible !== false)
  let deBlockY = sbTop + 8
  deBlocks.forEach(b => {
    deBlockY = deDarkSidebarBlock(doc, b.id, deBlockY, {
      sbX, sbCx, SIDEBAR_W, GOLD, TEXC, schoolInfo, categories, DE_COLORS,
    })
  })

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
  const bpPanelWBB = PAGE_W - MARGIN * 2 - SIDEBAR_W - 2
  const bottomLayoutBB = showBottomPanelBB ? bpComputeLayout(doc, events, settings.academicYear, bpPanelWBB, 80) : null
  const BOTTOM_H_BB = showBottomPanelBB ? (bottomLayoutBB?.panelH || 26) : 0
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

  if (showBottomPanelBB && bottomLayoutBB) {
    const panelY = startY + 3 * bbRowStep
    drawBottomEventsPanel(doc, categories, panelY, PAGE_W, MARGIN, SIDEBAR_W, bottomLayoutBB, settings)
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

    // Logo (always go through cropLogoImage so format + shape are handled correctly)
    if (schoolInfo.logo) {
      try {
        const shaped = await cropLogoImage(schoolInfo.logo, 'rounded')
        doc.addImage(shaped, 'PNG', MARGIN + 2, 13, 12, 12)
      } catch {}
    }

    // Grid
    const gridTop = 41
    const gridH = PH - gridTop - MARGIN - 4
    const cellW = (PW - MARGIN * 2) / 7
    const firstDay = getFirstDayOfWeek(year, month)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
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

      // Shabbat column tint (light sepia)
      if (col === 6 && dateKey) {
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
        doc.text('R.Ch.', cx + cellW - 1.5, cy + 4, { align: 'right' })
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
      let evY2 = cy + 11
      ;(events[dateKey] || []).slice(0, 3).forEach((ev) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        const hasTime = !!ev.time
        const boxH = hasTime ? 6.5 : 3.5
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 1, evY2, cellW - 2, boxH, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3.2)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1.5, evY2 + 2.5, { maxWidth: cellW - 3 })
        if (hasTime) {
          doc.setFontSize(2.5)
          doc.text(formatTime(ev.time), cx + 1.5, evY2 + 5.1, { maxWidth: cellW - 3 })
        }
        evY2 += boxH + 1
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
  doc.text(schoolName, MARGIN + 15, 9)
  doc.setFontSize(5.5)
  doc.setTextColor(gR, gG, gB)
  doc.text(settings.academicYear?.replace('-', '–') || '', PW - MARGIN, 9, { align: 'right' })

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
    const daysInMonth = new Date(year, month + 1, 0).getDate()
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
  doc.text(schoolName, MARGIN + 15, 9)
  doc.setFontSize(5)
  doc.setTextColor(gR, gG, gB)
  doc.text(settings.academicYear?.replace('-', '–') || '', PW - MARGIN, 9, { align: 'right' })

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
      const daysInMonth = new Date(year, month + 1, 0).getDate()
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

    // Primary color band over banner bottom — carries month name text
    doc.setFillColor(pr, pg, pb)
    doc.rect(0, BANNER_H - HEADER_OVERLAY_H, PW, HEADER_OVERLAY_H, 'F')

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
    const daysInMonth = new Date(year, month + 1, 0).getDate()
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

      let evY3 = cy + 13
      ;(events[dateKey] || []).slice(0, 3).forEach((ev) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        const hasTime = !!ev.time
        const boxH = hasTime ? 7 : 4
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 1, evY3, cellW - 2, boxH, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3.5)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1.5, evY3 + 3.2, { maxWidth: cellW - 3 })
        if (hasTime) {
          doc.setFontSize(2.5)
          doc.text(formatTime(ev.time), cx + 1.5, evY3 + 5.7, { maxWidth: cellW - 3 })
        }
        evY3 += boxH + 1
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
  doc.text(schoolName, MARGIN + 15, 9)
  doc.setFontSize(5)
  doc.setTextColor(ar, ag, ab)
  doc.text(settings.academicYear?.replace('-', '–') || '', PW - MARGIN, 9, { align: 'right' })

  // "Hebrew Dates" subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(180, 210, 255)
  doc.text('Hebrew / Gregorian Date Reference', PW / 2, 9, { align: 'center' })

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
    const daysInMonth = new Date(year, month + 1, 0).getDate()
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
    const daysInMonth = new Date(year, month + 1, 0).getDate()
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
        doc.text('R.Ch.', cx + cellW - 1.5, cy + 4.5, { align: 'right' })
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
      let evY4 = cy + 12
      ;(events[dateKey] || []).slice(0, 4).forEach((ev) => {
        const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
        const hasTime = !!ev.time
        const boxH = hasTime ? 6.8 : 3.8
        doc.setFillColor(er, eg, eb)
        doc.rect(cx + 1, evY4, cellW - 2, boxH, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(3)
        doc.setFont('helvetica', 'normal')
        doc.text(ev.label, cx + 1.5, evY4 + 2.8, { maxWidth: cellW - 3 })
        if (hasTime) {
          doc.setFontSize(2.5)
          doc.text(formatTime(ev.time), cx + 1.5, evY4 + 5.3, { maxWidth: cellW - 3 })
        }
        evY4 += boxH + 0.7
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
