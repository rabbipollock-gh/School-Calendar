import { saveAs } from 'file-saver'
import { getAcademicMonths } from './academicMonths.js'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey, groupConsecutiveDates, formatRangeLabel } from './dateUtils.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SHA']

function hexToRgb255(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return { r, g, b }
}

export async function exportPPTX(state) {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33" x 7.5"

  const { events, categories, schoolInfo, settings } = state
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })
  const shabbatLabel = settings.shabbatLabel || 'Shabbat'

  const slide = pptx.addSlide()

  // ── Background ──
  slide.background = { color: 'F8F9FA' }

  // ── Header bar ──
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.6, fill: { color: '1E3A5F' } })

  const schoolName = schoolInfo.name || 'YAYOE Calendar Builder'
  slide.addText(schoolName, {
    x: 0.8, y: 0.05, w: 8, h: 0.4,
    fontSize: 16, bold: true, color: 'FFFFFF', fontFace: 'Arial',
  })
  slide.addText(`Academic Year ${settings.academicYear || '2026–2027'}`, {
    x: 9, y: 0.1, w: 4, h: 0.3,
    fontSize: 9, color: 'CCDDFF', fontFace: 'Arial', align: 'right',
  })

  // Logo
  if (schoolInfo.logo) {
    try {
      slide.addImage({ data: schoolInfo.logo, x: 0.05, y: 0.05, w: 0.5, h: 0.5 })
    } catch {}
  }

  // ── Month grid: 4 cols × 3 rows ──
  const COLS = 4
  const CELL_W = 2.8
  const CELL_H = 2.1
  const START_X = 0.1
  const START_Y = 0.7

  getAcademicMonths(settings.academicYear).forEach(({ year, month }, idx) => {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    const mx = START_X + col * (CELL_W + 0.05)
    const my = START_Y + row * (CELL_H + 0.05)

    const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' })
    const hebrewLabel = getHebrewMonthLabel(year, month)

    // Month header
    slide.addShape(pptx.ShapeType.rect, { x: mx, y: my, w: CELL_W, h: 0.22, fill: { color: '1E3A5F' }, line: { color: '1E3A5F' } })
    slide.addText(`${monthName} ${year}  ${hebrewLabel}`, {
      x: mx + 0.05, y: my + 0.01, w: CELL_W - 0.1, h: 0.18,
      fontSize: 6, bold: true, color: 'FFFFFF', fontFace: 'Arial',
    })

    // Day header row
    const dayY = my + 0.24
    const dayCellW = CELL_W / 7
    DAYS.forEach((d, di) => {
      const label = di === 6 ? shabbatLabel.slice(0, 3).toUpperCase() : d
      if (di === 6) {
        slide.addShape(pptx.ShapeType.rect, {
          x: mx + di * dayCellW, y: dayY, w: dayCellW, h: 0.14,
          fill: { color: 'D4EEF7' }, line: { color: 'D4EEF7' },
        })
      }
      slide.addText(label, {
        x: mx + di * dayCellW, y: dayY, w: dayCellW, h: 0.14,
        fontSize: 4.5, bold: true, color: di === 6 ? '2E86AB' : '555555',
        fontFace: 'Arial', align: 'center',
      })
    })

    // Day cells
    const days = getDaysInMonth(year, month)
    const startDow = getFirstDayOfWeek(year, month)
    const cellH = (CELL_H - 0.42) / 6

    days.forEach(date => {
      const dayNum = date.getDate()
      const dow = (startDow + dayNum - 1) % 7
      const weekRow = Math.floor((startDow + dayNum - 1) / 7)
      const cx = mx + dow * dayCellW
      const cy = dayY + 0.14 + weekRow * cellH
      const dateKey = formatDateKey(date)
      const dayEvs = events[dateKey] || []

      if (dow === 6) {
        slide.addShape(pptx.ShapeType.rect, {
          x: cx, y: cy, w: dayCellW, h: cellH,
          fill: { color: 'E8F5FA' }, line: { color: 'E8F5FA' },
        })
      }

      slide.addText(String(dayNum), {
        x: cx + 0.01, y: cy + 0.01, w: dayCellW - 0.02, h: cellH * 0.5,
        fontSize: 4, color: '333333', fontFace: 'Arial',
      })

      // Event color dots as small squares
      dayEvs.slice(0, 2).forEach((ev, ei) => {
        const cat = catMap[ev.category]
        const color = (ev.color || cat?.color || '#999999').replace('#', '')
        slide.addShape(pptx.ShapeType.rect, {
          x: cx + 0.01 + ei * 0.08, y: cy + cellH * 0.55, w: 0.06, h: 0.06,
          fill: { color }, line: { color },
        })
      })
    })
  })

  // ── Legend sidebar ──
  const SB_X = START_X + COLS * (CELL_W + 0.05) + 0.05
  slide.addText('LEGEND', { x: SB_X, y: 0.7, w: 1.5, h: 0.2, fontSize: 7, bold: true, color: '1E3A5F' })

  let legendY = 0.95
  categories.filter(c => c.visible).forEach(cat => {
    const color = cat.color.replace('#', '')
    slide.addShape(pptx.ShapeType.rect, { x: SB_X, y: legendY, w: 0.12, h: 0.12, fill: { color }, line: { color } })
    slide.addText(cat.name, { x: SB_X + 0.15, y: legendY, w: 1.35, h: 0.14, fontSize: 5.5, color: '333333' })
    legendY += 0.18
  })

  // Address
  const addrLines = [
    schoolInfo.address || '',
    schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '',
    schoolInfo.fax ? `Fax: ${schoolInfo.fax}` : '',
  ].filter(Boolean)
  slide.addText(addrLines.join('\n'), {
    x: SB_X, y: 6.8, w: 2, h: 0.6, fontSize: 5, color: '666666',
  })

  const filename = `${(schoolInfo.name || 'YAYOE').replace(/\s+/g, '-')}-Calendar-2026-27.pptx`
  await pptx.writeFile({ fileName: filename })
}
