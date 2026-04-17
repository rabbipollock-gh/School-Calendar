import { jsPDF } from 'jspdf'
import { loadMontserrat } from './pdfFonts.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel, formatRangeGroups } from './dateUtils.js'

import { getAcademicMonths } from './academicMonths.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'
import { getRoshChodeshMap, getHolidayMap, getHebrewDayNumber } from '../data/hebrewCalendar.js'
import { getTheme, hexToRgb } from './themeUtils.js'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SHA']
const COL_COUNT = 4
const PAGE_W = 279.4  // US Letter landscape mm
const PAGE_H = 215.9
const MARGIN = 5
const SIDEBAR_W = 46
const HEADER_H = 14
const BOTTOM_PANEL_H = 38

function hexToRgbLocal(hex) {
  return hexToRgb(hex)
}

// Canonical category colors — consistent across events panel and footer legend.
// Falls back to the category's own stored color for custom/unknown categories.
const CAT_COLORS = {
  'no-school':       '#E24A3D',
  'early-dismissal': '#E89A2C',
  'chanukah':        '#E89A2C',
  'school-event':    '#2F7DD1',
  'staff':           '#8E56B8',
  'hebrew-only':     '#2FA38A',
}
function catColor(categoryId, fallback) {
  return CAT_COLORS[categoryId] || fallback || '#999999'
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

function drawMonth(doc, { year, month }, events, categories, settings, x, y, w, h, shabbatLabel, notesStripH, theme, emojiCache = {}, titleFont = 'helvetica') {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })
  const isFilled = settings.cellStyle === 'filled'
  const isCompact = settings.template === 'compact'
  const s = isCompact ? 0.82 : 1
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)
  // Medium grey for Shabbat — consistent weekly visual rhythm, theme-independent
  const SHABBAT_R = 192, SHABBAT_G = 192, SHABBAT_B = 198

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
  const cellH = (h - headerOffset - (notesStripH || 0)) / 6

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
        earlyDismissMap[dateKey] = { label: ev.label, time: ev.time, color: ev.color || cat?.color || '#D68910' }
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

    if (isNoSchool) {
      // No-school: soft rose tint (22% opacity of #E24A3D on white) — less visual noise at print scale
      doc.setFillColor(249, 215, 212)  // #E24A3D blended at 22% on white
      doc.roundedRect(cx + 0.15, cy + 0.15, cellW - 0.3, cellH - 0.3, 0.5, 0.5, 'F')
      // Date number — dark navy on light tint background
      doc.setTextColor(31, 45, 74)     // #1F2D4A
      doc.setFontSize(8 * s)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, cy + 3.5 * s)
      doc.setFont('helvetica', 'normal')
    } else if (isEarlyDismiss) {
      // ── Early dismissal: amber fill + date number + dismissal time ──
      const ed = earlyDismissMap[dateKey]
      const [r, g, b] = hexToRgbLocal(ed.color)
      doc.setFillColor(r, g, b)
      doc.roundedRect(cx + 0.15, cy + 0.15, cellW - 0.3, cellH - 0.3, 0.5, 0.5, 'F')
      // Date number
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(5.5 * s)
      doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 0.8, cy + 3 * s)
      // Dismissal time — the key info people need at a glance
      if (ed.time && cellH > 6) {
        doc.setFontSize(3.2 * s)
        doc.setFont('helvetica', 'normal')
        doc.text(formatTime(ed.time), cx + 0.8, cy + 3 * s + 3.5, { maxWidth: cellW - 1.2 })
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
      doc.text(String(dayNum), cx + 0.8, cy + 3 * s)
      if (cellH > 7 && firstEv.label) {
        doc.setFontSize(3.5 * s)
        doc.setFont('helvetica', 'normal')
        const lbl = firstEv.label.length > 12 ? firstEv.label.slice(0, 11) + '…' : firstEv.label
        doc.text(lbl, cx + 0.8, cy + 3 * s + 3.5 * s, { maxWidth: cellW - 1.2 })
      }
      doc.setFont('helvetica', 'normal')
    } else {
      // Dot mode — day number + colored dot + tiny label
      doc.setTextColor(31, 45, 74)   // #1F2D4A
      doc.setFontSize(8 * s)         // was 5.5 — larger, bolder day number
      doc.text(String(dayNum), cx + 0.8, cy + 3.5 * s)
      dayEvs.slice(0, 2).forEach((ev, evIdx) => {
        const cat = catMap[ev.category]
        const color = ev.color || cat?.color || '#999999'
        const [r, g, b] = hexToRgb(color)
        const dotY = cy + 5.5 * s + evIdx * 3.5 * s
        doc.setFillColor(r, g, b)
        doc.circle(cx + 1.2, dotY, 0.9 * s, 'F')
        if (ev.label && cellW > 8) {
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

    // Rosh Chodesh label — 6pt italic ABOVE the date number, centered, #4A5A7A
    if (rcMonth) {
      const RC_ABBREV = {
        'Tishrei':'Tish.','Cheshvan':'Ches.','Kislev':'Kis.','Tevet':'Tev.',
        'Shvat':'Shv.','Adar':'Adar','Adar I':'Ad.I','Adar II':'Ad.II',
        'Nisan':'Nis.','Iyar':'Iyar','Sivan':'Siv.','Tamuz':'Tam.',
        'Av':'Av','Elul':'Elul',
      }
      const rcShort = RC_ABBREV[rcMonth] || rcMonth.slice(0, 5)
      doc.setFontSize(5 * s)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(74, 90, 122)   // #4A5A7A — sits above date number, does not compete with it
      doc.text(`R.Ch. ${rcShort}`, cx + cellW / 2, cy + 1.8, { align: 'center', maxWidth: cellW - 0.6 })
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
    doc.setFillColor(248, 249, 251)
    doc.rect(x, notesY, w, stripH, 'F')
    doc.setDrawColor(200, 205, 215)
    doc.setLineWidth(0.2)
    doc.line(x, notesY, x + w, notesY)

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
    let noteLineY = notesY + 5
    for (const { ev, dates } of Object.values(notesEvents)) {
      if (noteLineY > maxNoteY) break
      const cat = catMap[ev.category]
      const color = ev.color || cat?.color || '#999999'
      const [r, g, b] = hexToRgb(color)
      // Darken the color 40% for text so light yellows/golds are readable on white
      const tr = Math.round(r * 0.62)
      const tg = Math.round(g * 0.62)
      const tb = Math.round(b * 0.62)
      doc.setFillColor(r, g, b)
      doc.rect(x + 1, noteLineY - 3.2, 4, 4, 'F')
      const isED = ev.category === 'early-dismissal' || (cat?.name?.toLowerCase() || '').includes('dismissal')
      const timeStr = (isED && ev.time) ? ` ${formatTime(ev.time)}` : ''
      const groups = groupConsecutiveDates([...dates].sort())
      const rangeStr = formatRangeGroups(groups)
      const rangePart = `  –  ${rangeStr}`
      doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      // Reserve space for time + range, then fit label in what's left
      const reservedW = doc.getTextWidth(timeStr + rangePart)
      const maxLabelW = Math.max((w - 7) - reservedW, 8)
      const displayLabel = doc.splitTextToSize(ev.label, maxLabelW)[0] || ev.label
      const labelW = doc.getTextWidth(displayLabel)
      doc.setTextColor(tr, tg, tb)
      doc.text(displayLabel, x + 6.5, noteLineY)
      if (timeStr) {
        doc.setFont('helvetica', 'normal')
        doc.text(timeStr, x + 6.5 + labelW, noteLineY)
      }
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(70, 72, 82)
      doc.text(rangePart, x + 6.5 + labelW + doc.getTextWidth(timeStr), noteLineY)
      noteLineY += 4.5
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

// Layout constants for the bottom events panel (shared by packing + rendering)
const BP_EV_LINE_H   = 8.5   // mm per event row (2-line: name + date + padding)
const BP_MONTH_HDR_H = 10    // mm per month header (bold label + gold accent line + padding)
const BP_MONTH_SEP   = 5     // mm gap between month groups in same column (~14pt)
const BP_OVERHEAD    = 14    // mm for panel title bar (10pt gold text + top/bottom padding)

// Pre-compute packed column layout for the bottom events panel.
// Month groups are kept ATOMIC — a month's header + all its events always land in
// the same column. Groups are bin-packed to target ~6 balanced columns.
function packBottomPanelMonths(events, academicYear) {
  const MONTHS = getAcademicMonths(academicYear)

  // Build atomic month groups: { mi, year, month, evItems: [{ev, dates}] }
  const monthGroups = []
  MONTHS.forEach(({ year, month }, mi) => {
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
    monthGroups.push({ mi, year, month, evItems })
  })

  // Height of one month group's content (separator between groups is added separately)
  const groupH = g => BP_MONTH_HDR_H + g.evItems.length * BP_EV_LINE_H

  const totalH = monthGroups.reduce((s, g) => s + groupH(g) + BP_MONTH_SEP, 0)

  // Target 6 columns; clamp 4–9 for very sparse/dense calendars
  const numCols = Math.max(4, Math.min(9, 6))
  const targetColH = totalH / numCols

  // Greedy bin-pack: whole month groups are atomic — never split across columns
  const columns = []
  let col = [], colUsed = 0
  monthGroups.forEach(group => {
    const gH = groupH(group)
    const sep = col.length > 0 ? BP_MONTH_SEP : 0
    if (col.length > 0 && colUsed + sep + gH > targetColH * 1.15) {
      columns.push(col)
      col = [group]
      colUsed = gH
    } else {
      col.push(group)
      colUsed += sep + gH
    }
  })
  if (col.length > 0) columns.push(col)

  // Tallest column height (with inter-group separators)
  const tallestH = columns.reduce((max, c) => {
    const h = c.reduce((s, g, i) => s + (i > 0 ? BP_MONTH_SEP : 0) + groupH(g), 0)
    return Math.max(max, h)
  }, 0)
  return { columns, tallestH }
}

// Takes precomputed bottomPack from packBottomPanelMonths()
// columns is Array<Array<MonthGroup>> where MonthGroup = { mi, year, month, evItems }
function drawBottomEventsPanel(doc, categories, y, pageW, margin, sidebarW, panelH, bottomPack, settings) {
  const MONTH_ABBR = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const panelY = y
  const panelW = pageW - margin * 2 - sidebarW - 2
  const eventsBottom = panelY + panelH - 2

  // Panel background — slightly lighter navy so accent colors read more vividly
  doc.setFillColor(26, 38, 64)   // #1A2640
  doc.roundedRect(margin, panelY, panelW, panelH, 2, 2, 'F')

  // Panel title — 10pt bold gold, uppercase
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(232, 182, 76)  // #E8B64C
  doc.text('EVENTS BY MONTH', margin + 4, panelY + 9)

  const { columns } = bottomPack
  const colW = panelW / columns.length
  const COL_START_Y = panelY + BP_OVERHEAD  // below title + padding

  columns.forEach((groups, ci) => {
    const colX = margin + ci * colW

    // Column separator — subtle vertical rule
    if (ci > 0) {
      doc.setDrawColor(45, 65, 95)
      doc.setLineWidth(0.25)
      doc.line(colX, panelY + 3, colX, panelY + panelH - 3)
    }

    let drawY = COL_START_Y

    groups.forEach((group, gi) => {
      // Inter-group rule + gap (not before first group in column)
      if (gi > 0) {
        drawY += 1.5
        doc.setDrawColor(60, 85, 120)   // ~rgba(255,255,255,0.15) on #1A2640
        doc.setLineWidth(0.4)
        doc.line(colX + 1.5, drawY, colX + colW - 1.5, drawY)
        drawY += BP_MONTH_SEP - 1.5
      }

      if (drawY + BP_MONTH_HDR_H > eventsBottom) return

      // ── Month header ──────────────────────────────────────────────
      // Bold 10pt white label
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(`${MONTH_ABBR[group.mi]} '${String(group.year).slice(2)}`, colX + 3, drawY + 4.5)
      // Gold 1.5pt accent line below month label
      const accentW = Math.min(21, colW - 5)   // ~60pt scaled to column
      doc.setDrawColor(232, 182, 76)            // #E8B64C
      doc.setLineWidth(0.53)                    // 1.5pt
      doc.line(colX + 3, drawY + 6, colX + 3 + accentW, drawY + 6)
      drawY += BP_MONTH_HDR_H

      // ── Event rows ────────────────────────────────────────────────
      group.evItems.forEach(({ ev, dates }) => {
        if (drawY + BP_EV_LINE_H > eventsBottom) return   // full row must fit inside panel
        const cat = catMap[ev.category]
        const color = catColor(ev.category, ev.color || cat?.color)
        const [r, g, b] = hexToRgb(color)

        // Left accent bar — 3pt (1.06mm) wide, full row height, category color
        doc.setFillColor(r, g, b)
        doc.rect(colX + 1, drawY, 1.06, BP_EV_LINE_H, 'F')

        // Line 1: event name — bold 8pt white
        const maxLabelW = colW - 5.5
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        let displayLabel = doc.splitTextToSize(ev.label, maxLabelW)[0] || ev.label
        // Auto-shrink if still too wide
        if (doc.getTextWidth(displayLabel) > maxLabelW) {
          doc.setFontSize(7)
        }
        doc.text(displayLabel, colX + 4, drawY + 4.0)

        // Line 2: date range + optional time — 7pt #C8D4E8
        const dateGroups = groupConsecutiveDates([...dates].sort())
        const rangeText = formatRangeGroups(dateGroups)
        const regTime = ev.regularDismissal && settings?.regularDismissalTime ? settings.regularDismissalTime : null
        const effectiveTime = ev.time || regTime
        const timeStr = effectiveTime ? ` ${formatTime(effectiveTime)}` : ''
        doc.setFontSize(7)
        doc.setFont('helvetica', effectiveTime ? 'italic' : 'normal')
        doc.setTextColor(200, 212, 232)   // #C8D4E8
        doc.text(rangeText + timeStr, colX + 4, drawY + 7.2)
        doc.setFont('helvetica', 'normal')

        drawY += BP_EV_LINE_H
      })
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
  doc.setFontSize(4); doc.setFont('helvetica', 'normal')
  for (const { ev, dates } of Object.values(notesEvents)) {
    if (lineY > maxY) break
    const cat = catMap[ev.category]
    const color = ev.color || cat?.color || '#999'
    const [r, g, b] = hexToRgbLocal(color)
    doc.setFillColor(r, g, b); doc.circle(x + 1, lineY - 0.5, 0.6, 'F')
    const groups = groupConsecutiveDates([...dates].sort())
    const rangeStr = formatRangeGroups(groups)
    const lineText = `${rangeStr} | ${ev.label}`
    const lines = doc.splitTextToSize(lineText, w - 3.5)
    doc.setTextColor(60, 60, 60)
    doc.text(lines, x + 2.5, lineY, { maxWidth: w - 3.5 })
    lineY += lines.length * 1.8 + 0.6
  }
}

export async function exportPDF(state, { preview = false, pdfStyle = 'classic', monthIndex = null } = {}) {
  const { events, categories, schoolInfo, settings } = state
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
  if (pdfStyle === 'portrait-classic')  return exportPortraitClassic(state, { preview })
  // default: classic
  const isCompact = settings.template === 'compact'
  const showBottomPanel = settings.eventsPanel === 'bottom'

  // Layout measurements — full-width grid (sidebar moved to footer bar at page bottom)
  const CLASSIC_FOOTER_H = 16
  const GRID_W = PAGE_W - MARGIN * 2
  const MONTH_W = (GRID_W / COL_COUNT) - 2
  const MONTH_ROWS = 3
  // Pre-compute packed column layout so panel height is sized from the result,
  // not from the busiest single month (which was too short to allow stacking).
  const bottomPack = showBottomPanel ? packBottomPanelMonths(events, settings.academicYear) : null
  const dynamicPanelH = showBottomPanel
    ? Math.min(Math.max(BOTTOM_PANEL_H, bottomPack.tallestH + BP_OVERHEAD + 4), 110)
    : 0
  const availH = showBottomPanel
    ? PAGE_H - (HEADER_H + 2) - MARGIN - dynamicPanelH - CLASSIC_FOOTER_H - 4
    : PAGE_H - (HEADER_H + 2) - MARGIN - CLASSIC_FOOTER_H - 2
  const ROW_GAP = 3
  const HEADER_OFFSET = isCompact ? 9 : 10   // matches drawMonth headerOffset
  const allMonths = getAcademicMonths(settings.academicYear)
  // Per-row max events → per-row notes heights (uncapped — grows to fit each row's busiest month)
  // Notes lines use 7pt font at 4.5mm line spacing, so each event ≈ 4.5mm + top padding
  const perRowNotesH = showBottomPanel
    ? Array(MONTH_ROWS).fill(0)
    : Array.from({ length: MONTH_ROWS }, (_, row) => {
        // Column-first layout: row `row` contains months at positions row, row+MONTH_ROWS, row+2*MONTH_ROWS, …
        const rowMonths = allMonths.filter((_, idx) => idx % MONTH_ROWS === row)
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
        return maxEv > 0 ? Math.max(13, maxEv * 4.5 + 4.5) : 0
      })
  const totalNotesH = perRowNotesH.reduce((a, b) => a + b, 0)
  // Single CELL_H for all rows — fills all available space exactly (no compact shrink factor;
  // compact appearance is handled inside drawMonth via font scaling)
  const CELL_H = Math.max(3.5,
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
    // Column-first: fill each column top-to-bottom before moving right
    // Aug/Sep/Oct → col 0, Nov/Dec/Jan → col 1, Feb/Mar/Apr → col 2, May/Jun → col 3
    const row = idx % MONTH_ROWS
    const col = Math.floor(idx / MONTH_ROWS)
    const mx = MARGIN + col * (MONTH_W + 2)
    const mw = MONTH_W
    const y = rowStartY[row]
    const monthH = perRowMonthH[row]
    const notesH = perRowNotesH[row]
    drawMonth(doc, { year, month }, events, categories, settings, mx, y, mw, monthH, shabbatLabel, notesH, theme, emojiCache, titleFont)
  })

  // ── Bottom Events Panel ──────────────────────────────
  if (showBottomPanel) {
    const panelTop = rowStartY[MONTH_ROWS - 1] + perRowMonthH[MONTH_ROWS - 1] + 2
    drawBottomEventsPanel(doc, categories, panelTop, PAGE_W, MARGIN, 0, dynamicPanelH, bottomPack, settings)
  }

  // ── Footer bar (school info + legend — replaces right sidebar) ─────────────
  const footerY = PAGE_H - MARGIN - CLASSIC_FOOTER_H
  // Light background panel
  doc.setFillColor(248, 249, 252)
  doc.rect(MARGIN, footerY, PAGE_W - MARGIN * 2, CLASSIC_FOOTER_H, 'F')
  // 0.5pt separator rule at top of footer — clean, unobtrusive #E1E4EA
  doc.setDrawColor(225, 228, 234)
  doc.setLineWidth(0.18)
  doc.line(MARGIN, footerY, PAGE_W - MARGIN, footerY)
  // Outer border
  doc.setLineWidth(0.18)
  doc.rect(MARGIN, footerY, PAGE_W - MARGIN * 2, CLASSIC_FOOTER_H, 'S')

  // Clipping boundary for all footer text — nothing renders below this Y
  const footBottom = footerY + CLASSIC_FOOTER_H - 1

  // §1: Logo + school name + menahel/principal line + contact info
  const FOOT_LOGO_SZ = 11
  const footLogoX = MARGIN + 2
  const footLogoY = footerY + (CLASSIC_FOOTER_H - FOOT_LOGO_SZ) / 2 + 0.5
  if (classicCircularLogo) {
    doc.addImage(classicCircularLogo, 'PNG', footLogoX, footLogoY, FOOT_LOGO_SZ, FOOT_LOGO_SZ)
  }
  const footInfoX = footLogoX + FOOT_LOGO_SZ + 2.5
  const footInfoMaxW = 68
  doc.setFontSize(6.5); doc.setFont(titleFont, 'bold'); doc.setTextColor(pr, pg, pb)
  doc.text(schoolInfo.name || 'YAYOE', footInfoX, footerY + 5, { maxWidth: footInfoMaxW })

  // Helper: render one contact line, advance Y, stop if we'd overflow the footer box
  let fcy = footerY + 8.2
  const footLine = (text, color) => {
    if (!text || fcy > footBottom) return
    doc.setTextColor(...color)
    // Force single line — take first split segment only
    const oneLine = doc.splitTextToSize(String(text), footInfoMaxW)[0] || ''
    doc.text(oneLine, footInfoX, fcy)
    fcy += 2.8
  }
  doc.setFontSize(4); doc.setFont('helvetica', 'italic')
  footLine(schoolInfo.otherInfo, [pr, pg, pb])           // Menahel / Principal (italic, primary color)
  doc.setFont('helvetica', 'normal')
  footLine(schoolInfo.address,                [90, 100, 120])
  // Phone + fax on same line if both exist
  const phoneFaxStr = [
    schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '',
    schoolInfo.fax   ? `Fax: ${schoolInfo.fax}`   : '',
  ].filter(Boolean).join('   ')
  footLine(phoneFaxStr,                       [90, 100, 120])
  footLine(schoolInfo.email,                  [42, 100, 180])
  footLine(schoolInfo.website,                [42, 100, 180])

  // Divider 1
  const footDiv1X = MARGIN + 88
  doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.3)
  doc.line(footDiv1X, footerY + 3, footDiv1X, footerY + CLASSIC_FOOTER_H - 2)

  // §2: School hours — up to 3 lines (Mon–Thu / Fri / Erev Yom Tov)
  const footHoursX = footDiv1X + 5
  const hourLines = (schoolInfo.hours || '').split('\n').filter(l => l.trim())
  if (hourLines.length) {
    doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
    doc.text('SCHOOL HOURS', footHoursX, footerY + 5)
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 60, 80)
    hourLines.slice(0, 3).forEach((line, i) => {
      const lineY = footerY + 8.2 + i * 2.8
      if (lineY <= footBottom) doc.text(line.trim(), footHoursX, lineY, { maxWidth: 60 })
    })
  }

  // Divider 2
  const footDiv2X = MARGIN + 160
  doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.3)
  doc.line(footDiv2X, footerY + 3, footDiv2X, footerY + CLASSIC_FOOTER_H - 2)

  // §3: Legend — 3 cols × 2 rows = up to 6 categories
  const footLegX = footDiv2X + 4
  const footLegW = PAGE_W - MARGIN - footLegX - 2
  const visibleCatsFooter = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
  doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
  doc.text('LEGEND', footLegX, footerY + 5)
  const legCols = 3
  const legColW = footLegW / legCols
  visibleCatsFooter.slice(0, legCols * 2).forEach((cat, i) => {
    const col = i % legCols
    const row = Math.floor(i / legCols)
    const itemY = footerY + 8.2 + row * 3.2   // 4pt row padding
    if (itemY > footBottom) return
    const [r, g, b] = hexToRgbLocal(catColor(cat.id, cat.color))
    const itemX = footLegX + col * legColW
    doc.setFillColor(r, g, b)
    doc.roundedRect(itemX, itemY - 2.2, 4, 3, 0.3, 0.3, 'F')
    doc.setTextColor(31, 45, 74); doc.setFontSize(5); doc.setFont('helvetica', 'normal')  // #1F2D4A
    doc.text(cat.name, itemX + 5, itemY, { maxWidth: legColW - 6.5 })
  })

  if (preview) return doc.output('datauristring')
  doc.save(`${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-${settings.academicYear || '2026-27'}-${pdfStyle}.pdf`)
}

// ────────────────────────────────────────────────────────────────────────────
// Portrait Classic — 2-column portrait, month header on top, notes on right
// ────────────────────────────────────────────────────────────────────────────
async function exportPortraitClassic(state, { preview = false } = {}) {
  const { events, categories, schoolInfo, settings } = state
  const theme = getTheme(settings.theme, settings.customPrimary, settings.customAccent)
  const [pr, pg, pb] = hexToRgbLocal(theme.primary)
  const [ar, ag, ab] = hexToRgbLocal(theme.accent)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const hasMontserrat = await loadMontserrat(doc)
  const titleFont = hasMontserrat ? 'Montserrat' : 'helvetica'
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'

  const PW = 215.9, PH = 279.4
  const MARGIN = 5
  const HEADER_H = 14
  const FOOTER_H = 16
  const COL_COUNT = 2
  const MONTH_ROWS = 6      // 11 months: rows 0–4 have 2 each, row 5 has 1
  const ROW_GAP = 2
  const COL_GAP = 2
  const BLOCK_HEADER_H = 5  // thin blue header on top of each month block
  const NOTES_W = 36        // right-side notes column
  const INNER_GAP = 1       // gap between calendar and notes
  const SHABBAT_R = 192, SHABBAT_G = 192, SHABBAT_B = 198

  const GRID_W = PW - MARGIN * 2                              // 205.9mm
  const MONTH_W = (GRID_W - COL_GAP) / COL_COUNT             // ~101.95mm
  const CAL_W = MONTH_W - NOTES_W - INNER_GAP                // ~64.95mm
  const cellW = CAL_W / 7                                     // ~9.28mm
  const DOW_H = 3.5
  const availH = PH - (HEADER_H + 2) - MARGIN - FOOTER_H - 2 // 240.4mm
  const MONTH_H = (availH - (MONTH_ROWS - 1) * ROW_GAP) / MONTH_ROWS  // 38.4mm
  // cells start at BLOCK_HEADER_H + DOW_H; exact fit so row 6 never overflows
  const cellH = (MONTH_H - BLOCK_HEADER_H - DOW_H) / 6       // ~4.98mm

  // ── Header (same as landscape classic) ──────────────────────────────────
  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, PW * 0.62, HEADER_H, 'F')
  doc.setFillColor(Math.min(255, pr + 12), Math.min(255, pg + 16), Math.min(255, pb + 25))
  doc.rect(PW * 0.62, 0, PW * 0.38, HEADER_H, 'F')
  doc.setFillColor(ar, ag, ab)
  doc.rect(0, HEADER_H - 1.5, PW, 1.5, 'F')
  doc.rect(0, 0, 3, HEADER_H - 1.5, 'F')

  const LOGO_SIZE = 11
  let circularLogo = null
  if (schoolInfo.logo) {
    try {
      circularLogo = await cropLogoImage(schoolInfo.logo, settings.logoShape || 'circle')
      doc.addImage(circularLogo, 'PNG', MARGIN, (HEADER_H - LOGO_SIZE) / 2, LOGO_SIZE, LOGO_SIZE)
    } catch {}
  }

  const titleX = MARGIN + LOGO_SIZE + 3
  doc.setFontSize(12); doc.setFont(titleFont, 'bold'); doc.setTextColor(255, 255, 255)
  doc.text(settings.calendarTitle || schoolInfo.name || 'YAYOE Calendar', titleX, 6.2)
  doc.setFontSize(7); doc.setFont(titleFont, 'normal')
  const hebrewYearStr = settings.hebrewYear || ''
  const yearLine = settings.showHebrewYear !== false && hebrewYearStr
    ? `Academic Year  ${settings.academicYear || '2026–2027'}  •  ${hebrewYearStr}`
    : `Academic Year  ${settings.academicYear || '2026–2027'}`
  doc.text(yearLine, titleX, 10.7)

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

  // Build full cross-month run groups once (same approach as landscape classic)
  // so notes can show the complete date range even when a break spans two months
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

    // ── Blue month header bar (full block width) ────────────────────────
    const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hLabel = getHebrewMonthLabel(year, month)
    doc.setFillColor(pr, pg, pb)
    doc.roundedRect(mx, my, MONTH_W, BLOCK_HEADER_H, 1, 1, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont('helvetica', 'bold')
    const engPart = `${mName} ${year}`
    doc.text(engPart, mx + 1.5, my + 3.5 * (BLOCK_HEADER_H / 5))
    const engW = doc.getTextWidth(engPart)
    doc.setTextColor(180, 210, 255); doc.setFont('helvetica', 'normal')
    doc.text(`  ·  ${hLabel}`, mx + 1.5 + engW, my + 3.5 * (BLOCK_HEADER_H / 5), { maxWidth: MONTH_W - 3 - engW - 1.5 })

    // ── Day-of-week header row ───────────────────────────────────────────
    const calX = mx
    const dowY = my + BLOCK_HEADER_H + DOW_H - 0.8

    DOW_LABELS.forEach((d, i) => {
      const lx = calX + i * cellW
      if (i === 6) {
        doc.setFillColor(SHABBAT_R, SHABBAT_G, SHABBAT_B)
        doc.rect(lx, my + BLOCK_HEADER_H, cellW, DOW_H, 'F')
      }
      doc.setTextColor(i === 6 ? 88 : 70, i === 6 ? 88 : 70, i === 6 ? 96 : 70)
      doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
      doc.text(d === 'S' && i === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d,
        lx + cellW / 2, dowY, { align: 'center' })
    })

    // ── Day cells ────────────────────────────────────────────────────────
    const days = getDaysInMonth(year, month)
    const startDow = getFirstDayOfWeek(year, month)

    // Pre-classify no-school / early-dismissal
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

      if (dow === 6) {
        doc.setFillColor(SHABBAT_R, SHABBAT_G, SHABBAT_B)
        doc.rect(cx, cy, cellW, cellH, 'F')
      }

      if (isNoSchool) {
        doc.setFillColor(192, 57, 43)
        doc.roundedRect(cx + 0.1, cy + 0.1, cellW - 0.2, cellH - 0.2, 0.4, 0.4, 'F')
        doc.setDrawColor(222, 95, 78); doc.setLineWidth(0.15)
        for (let hx = 2; hx < cellW + cellH; hx += 2) {
          const ax = cx + 0.1 + Math.min(hx, cellW - 0.2)
          const ay = cy + 0.1 + Math.max(0, hx - (cellW - 0.2))
          const bx = cx + 0.1 + Math.max(0, hx - (cellH - 0.2))
          const by = cy + 0.1 + Math.min(hx, cellH - 0.2)
          doc.line(ax, ay, bx, by)
        }
        doc.setTextColor(255, 255, 255); doc.setFontSize(4.5); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 0.6, cy + 3.2)
      } else if (isEarlyDismiss) {
        const ed = earlyDismissMap[dk]
        const [r, g, b] = hexToRgbLocal(ed.color)
        doc.setFillColor(r, g, b)
        doc.roundedRect(cx + 0.1, cy + 0.1, cellW - 0.2, cellH - 0.2, 0.4, 0.4, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(4.5); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 0.6, cy + 2.8)
        if (ed.time) {
          doc.setFontSize(3); doc.setFont('helvetica', 'normal')
          doc.text(formatTime(ed.time), cx + 0.6, cy + 5, { maxWidth: cellW - 1 })
        }
      } else if (settings.cellStyle === 'filled' && dayEvs.length > 0) {
        const firstEv = dayEvs[0]
        const cat = catMap[firstEv.category]
        const [r, g, b] = hexToRgbLocal(firstEv.color || cat?.color || '#999')
        doc.setFillColor(r, g, b)
        doc.roundedRect(cx + 0.1, cy + 0.1, cellW - 0.2, cellH - 0.2, 0.4, 0.4, 'F')
        doc.setTextColor(255, 255, 255); doc.setFontSize(4.5); doc.setFont('helvetica', 'bold')
        doc.text(String(dayNum), cx + 0.6, cy + 3.2)
        if (firstEv.label) {
          doc.setFontSize(2.8); doc.setFont('helvetica', 'normal')
          doc.text(firstEv.label, cx + 0.6, cy + 3.2 + 2.2, { maxWidth: cellW - 1 })
        }
      } else {
        doc.setTextColor(50, 50, 50); doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
        doc.text(String(dayNum), cx + 0.6, cy + 3.2)
        // Rosh Chodesh dot
        if (getRoshChodeshMap(settings.academicYear)[dk]) {
          doc.setFillColor(195, 177, 225)
          doc.circle(cx + cellW - 1.3, cy + 1.3, 0.7, 'F')
        }
        // Event color dots (max 2)
        dayEvs.slice(0, 2).forEach((ev, ei) => {
          const cat = catMap[ev.category]
          const [r, g, b] = hexToRgbLocal(ev.color || cat?.color || '#999')
          doc.setFillColor(r, g, b)
          doc.circle(cx + 0.9 + ei * 1.8, cy + cellH - 1.1, 0.65, 'F')
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

    // Subtle cell grid lines (below the block header)
    const gridTop = my + BLOCK_HEADER_H
    doc.setDrawColor(220, 222, 230); doc.setLineWidth(0.1)
    for (let r = 0; r <= 6; r++)
      doc.line(calX, gridTop + DOW_H + r * cellH, calX + CAL_W, gridTop + DOW_H + r * cellH)
    for (let c = 0; c <= 7; c++)
      doc.line(calX + c * cellW, gridTop, calX + c * cellW, my + MONTH_H)

    // ── Notes column ────────────────────────────────────────────────────
    const notesX = calX + CAL_W + INNER_GAP

    // Collect notes using full run groups so cross-month breaks (Pesach, Sukkos)
    // show their complete date range, not just the portion within this month
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

    let noteY = my + BLOCK_HEADER_H + 3.5
    const maxNoteY = my + MONTH_H - 1.5
    for (const { ev, dates } of seenEvts.values()) {
      if (noteY > maxNoteY) break
      const cat = catMap[ev.category]
      const [r, g, b] = hexToRgbLocal(ev.color || cat?.color || '#999')
      // Color swatch
      doc.setFillColor(r, g, b)
      doc.roundedRect(notesX, noteY - 2.4, 3, 3, 0.3, 0.3, 'F')
      // Label (colored) + time (colored) + range (gray) — all on one line
      const isED = ev.category === 'early-dismissal' || (cat?.name?.toLowerCase() || '').includes('dismissal')
      const timeStr = isED && ev.time ? ` ${formatTime(ev.time)}` : ''
      const groups = groupConsecutiveDates([...dates].sort())
      const rangeStr = formatRangeGroups(groups)
      const rangePart = `  –  ${rangeStr}`
      doc.setFontSize(5); doc.setFont('helvetica', 'normal')
      // Reserve space for time + range, then fit label in what's left
      const reservedW = doc.getTextWidth(timeStr + rangePart)
      const maxLabelW = Math.max(NOTES_W - 5 - reservedW, 6)
      const displayLabel = doc.splitTextToSize(ev.label, maxLabelW)[0] || ev.label
      const labelW = doc.getTextWidth(displayLabel)
      doc.setTextColor(r, g, b)
      doc.text(displayLabel, notesX + 4, noteY)
      if (timeStr) {
        doc.text(timeStr, notesX + 4 + labelW, noteY)
      }
      doc.setTextColor(90, 95, 110)
      doc.text(rangePart, notesX + 4 + labelW + doc.getTextWidth(timeStr), noteY)
      noteY += 3.8
    }
  })

  // ── Footer (same layout as Classic, adjusted for portrait width) ─────────
  const footerY = PH - MARGIN - FOOTER_H
  doc.setFillColor(ar, ag, ab)
  doc.rect(MARGIN, footerY, GRID_W, 1.5, 'F')
  doc.setFillColor(248, 249, 252)
  doc.rect(MARGIN, footerY + 1.5, GRID_W, FOOTER_H - 1.5, 'F')
  doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.2)
  doc.rect(MARGIN, footerY + 1.5, GRID_W, FOOTER_H - 1.5, 'S')

  const footBottom = footerY + FOOTER_H - 1.5

  // §1: Logo + school name + contact
  const FOOT_LOGO_SZ = 11
  const footLogoX = MARGIN + 2
  const footLogoY = footerY + (FOOTER_H - FOOT_LOGO_SZ) / 2 + 0.5
  if (circularLogo) doc.addImage(circularLogo, 'PNG', footLogoX, footLogoY, FOOT_LOGO_SZ, FOOT_LOGO_SZ)
  const footInfoX = footLogoX + FOOT_LOGO_SZ + 2.5
  const footInfoMaxW = 52
  doc.setFontSize(6.5); doc.setFont(titleFont, 'bold'); doc.setTextColor(pr, pg, pb)
  doc.text(schoolInfo.name || 'YAYOE', footInfoX, footerY + 5, { maxWidth: footInfoMaxW })
  let fcy = footerY + 8.2
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
  const footDiv1X = MARGIN + 70
  doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.3)
  doc.line(footDiv1X, footerY + 3, footDiv1X, footerY + FOOTER_H - 2)
  const footHoursX = footDiv1X + 5
  const hourLines = (schoolInfo.hours || '').split('\n').filter(l => l.trim())
  if (hourLines.length) {
    doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
    doc.text('SCHOOL HOURS', footHoursX, footerY + 5)
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 60, 80)
    hourLines.slice(0, 3).forEach((line, i) => {
      const lineY = footerY + 8.2 + i * 2.8
      if (lineY <= footBottom) doc.text(line.trim(), footHoursX, lineY, { maxWidth: 52 })
    })
  }

  // §3: Legend
  const footDiv2X = MARGIN + 125
  doc.setDrawColor(210, 215, 225); doc.setLineWidth(0.3)
  doc.line(footDiv2X, footerY + 3, footDiv2X, footerY + FOOTER_H - 2)
  const footLegX = footDiv2X + 4
  const footLegW = PW - MARGIN - footLegX - 2
  const visibleCatsFooter = categories.filter(c => c.visible && c.id !== 'rosh-chodesh')
  doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
  doc.text('LEGEND', footLegX, footerY + 5)
  const legCols = 3
  const legColW = footLegW / legCols
  visibleCatsFooter.slice(0, legCols * 2).forEach((cat, i) => {
    const col = i % legCols
    const row = Math.floor(i / legCols)
    const itemY = footerY + 8.2 + row * 3.2   // 4pt row padding
    if (itemY > footBottom) return
    const [r, g, b] = hexToRgbLocal(catColor(cat.id, cat.color))
    const itemX = footLegX + col * legColW
    doc.setFillColor(r, g, b)
    doc.roundedRect(itemX, itemY - 2.2, 4, 3, 0.3, 0.3, 'F')
    doc.setTextColor(31, 45, 74); doc.setFontSize(5); doc.setFont('helvetica', 'normal')  // #1F2D4A
    doc.text(cat.name, itemX + 5, itemY, { maxWidth: legColW - 6.5 })
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
}) {
  const days = getDaysInMonth(year, month)
  const startDow = getFirstDayOfWeek(year, month)
  const cellW = w / 7
  const HEADER_H = 8
  const DAY_H = 5
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
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(x, y, w, HEADER_H, 1, 1, 'F')
  doc.setFillColor(ar, ag, ab)
  doc.rect(x, y + HEADER_H - 1.5, w, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6); doc.setFont(titleFont, 'bold')
  const mName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
  const heLabel = getHebrewMonthLabel(year, month)
  doc.text(mName, x + 2, y + 5.5, { maxWidth: w - 4 })
  if (heLabel) {
    doc.setFontSize(4.5); doc.setFont('helvetica', 'normal')
    doc.setTextColor(ar, ag, ab)
    doc.text(heLabel, x + w - 1.5, y + 5.5, { align: 'right', maxWidth: w * 0.45 })
  }

  // Day-of-week header row
  const headY = y + HEADER_H + DAY_H - 1
  DAYS.forEach((d, i) => {
    const isSha = i === 6
    const colX = x + i * cellW
    const colW = isSha ? (x + w) - colX : cellW
    if (isSha) {
      doc.setFillColor(188, 188, 196)
      doc.setGState(doc.GState({ opacity: 0.35 }))
      doc.rect(colX, y + HEADER_H, colW, DAY_H, 'F')
      doc.setGState(doc.GState({ opacity: 1.0 }))
    }
    doc.setTextColor(isSha ? 100 : 120, isSha ? 100 : 120, isSha ? 118 : 120)
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

    // Shabbat tint — neutral grey (avoids clash with themed primary or event colors)
    if (isSha) {
      doc.setFillColor(188, 188, 196)
      doc.setGState(doc.GState({ opacity: 0.28 }))
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
      const [er, eg, eb] = hexToRgbLocal(dayEvs[0].color || cat?.color || '#999')
      doc.setFillColor(er, eg, eb)
      doc.roundedRect(cx + 0.2, cy + 0.2, cw - 0.4, cellH - 0.4, 0.4, 0.4, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(3.5); doc.setFont('helvetica', 'bold')
      doc.text(String(dayNum), cx + 1, cy + 3.2, { maxWidth: cw - 1.5 })
      // Event label — smart abbreviation in glance mode, word-truncation otherwise
      if (showLabel) {
        const rawLabel = dayEvs[0].label || ''
        const displayLabel = glanceMode
          ? smartAbbrevLabel(rawLabel)
          : (rawLabel.length > 12 ? rawLabel.slice(0, 11) + '…' : rawLabel)
        doc.setFontSize(2.8); doc.setFont('helvetica', 'normal')
        doc.text(displayLabel, cx + 1, cy + 5.8, { maxWidth: cw - 1.5 })
      }
    } else {
      // Normal day number
      doc.setTextColor(isSha ? 95 : 50, isSha ? 95 : 50, isSha ? 112 : 50)
      doc.setFontSize(3.8); doc.setFont('helvetica', isSha ? 'bold' : 'normal')
      doc.text(String(dayNum), cx + 1, cy + 3.2, { maxWidth: cw - 1.5 })
    }

    // Cell border
    doc.setDrawColor(210, 215, 220); doc.setLineWidth(0.15)
    doc.rect(cx, cy, cw, cellH, 'S')

    // Hebrew holiday badge — only when no user event (prevents double-labeling)
    if (dayEvs.length === 0 && hebrewHolidayMini && settings.hebrewHolidayToggles?.[hebrewHolidayMini.group] !== false) {
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
  // Year label — draw first so title can be measured against it
  const yearLabel = settings.academicYear || '2026-2027'
  doc.setFontSize(8); doc.setFont(titleFont, 'normal'); doc.setTextColor(130, 130, 130)
  doc.text(yearLabel, PAGE_W - MARGIN, 9, { align: 'right' })
  // Title — reserve space for logo (if present) and year label on right
  const titleStartX = circLogoMin ? MARGIN + 13 : MARGIN
  doc.setTextColor(pr, pg, pb)
  doc.setFontSize(11); doc.setFont(titleFont, 'bold')
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', titleStartX, 9, { maxWidth: PAGE_W - titleStartX - MARGIN - 28 })

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

  // Legend strip at bottom — solid rounded rect swatches matching cell style
  const legY = PAGE_H - 7
  doc.setFillColor(248, 249, 252); doc.rect(0, legY - 2, PAGE_W, 10, 'F')
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(0, legY - 2, PAGE_W, legY - 2)
  let legX = MARGIN
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 8).forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb)
    doc.roundedRect(legX, legY - 1.5, 8, 5, 0.5, 0.5, 'F')
    doc.setTextColor(60, 60, 60); doc.setFontSize(5); doc.setFont('helvetica', 'bold')
    doc.text(cat.name, legX + 10, legY + 2)
    legX += doc.getTextWidth(cat.name) + 16
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
  // Draw year label first (right-aligned anchor) — fixes "202" truncation from Letter/A4 mismatch
  const glanceYearStr = `Year at a Glance  ·  ${settings.academicYear || '2026-2027'}`
  doc.setTextColor(ar, ag, ab); doc.setFontSize(7); doc.setFont(titleFont, 'normal')
  doc.text(glanceYearStr, PAGE_W - MARGIN - 2, 8, { align: 'right' })
  // School name — maxWidth leaves room for year label
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont(titleFont, 'bold')
  const glanceTitleX = circLogoGlance ? MARGIN + 11 : MARGIN + 2
  const glanceYearW = doc.getTextWidth(glanceYearStr)
  doc.text(settings.calendarTitle || schoolInfo.name || 'Academic Calendar', glanceTitleX, 8, {
    maxWidth: PAGE_W - glanceTitleX - glanceYearW - MARGIN - 4
  })

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
      x: mx, y: my, w: MONTH_W, h: MONTH_H, pr, pg, pb, ar, ag, ab, titleFont, shabbatLabel,
      glanceMode: true,
    })
  })

  // Legend — solid rounded rect swatches matching cell style
  const legY = PAGE_H - 6
  doc.setFillColor(248, 249, 252); doc.rect(0, legY - 2, PAGE_W, 9, 'F')
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(0, legY - 2, PAGE_W, legY - 2)
  let lx = MARGIN
  categories.filter(c => c.visible && c.id !== 'rosh-chodesh').slice(0, 10).forEach(cat => {
    const [cr, cg, cb] = hexToRgbLocal(cat.color || '#999')
    doc.setFillColor(cr, cg, cb)
    doc.roundedRect(lx, legY - 1.5, 7, 4.5, 0.4, 0.4, 'F')
    doc.setTextColor(60, 60, 60); doc.setFontSize(4.5); doc.setFont('helvetica', 'bold')
    doc.text(cat.name, lx + 9, legY + 1.8)
    lx += doc.getTextWidth(cat.name) + 15
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
