import React, { useMemo, useRef } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import DayCell from './DayCell.jsx'
import NotesStrip from './NotesStrip.jsx'
import { getDaysInMonth, getFirstDayOfWeek, formatDateKey } from '../utils/dateUtils.js'
import { getHebrewMonthLabel } from '../data/hebrewMonthNames.js'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function MonthBlock({ year, month, onOpenModal, focusedDate, onResetMonth }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { settings, events, categories } = state

  const shabbatLabel = settings.shabbatLabel || 'Shabbat'
  const hebrewLabel = getHebrewMonthLabel(year, month)

  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const startDow = useMemo(() => getFirstDayOfWeek(year, month), [year, month])

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const eventCount = useMemo(() => {
    return Object.entries(events)
      .filter(([dk]) => dk.startsWith(monthKey))
      .reduce((sum, [, evs]) => sum + (evs?.length || 0), 0)
  }, [events, monthKey])

  // Monthly school day count: Mon–Fri, within first/last day bounds, excluding no-school events
  const monthSchoolDays = useMemo(() => {
    const firstDay = settings.firstDayOfSchool
    const lastDay  = settings.lastDayOfSchool
    const rangeStart = firstDay ? new Date(firstDay + 'T00:00:00') : null
    const rangeEnd   = lastDay  ? new Date(lastDay  + 'T00:00:00') : null

    // No-school category ids (always 'no-school', but respect custom cats too)
    const noSchoolCatIds = new Set(categories.filter(c => c.id === 'no-school').map(c => c.id))
    const noSchoolDates = new Set(
      Object.entries(events)
        .filter(([dk, evs]) => dk.startsWith(monthKey) && evs.some(e => noSchoolCatIds.has(e.category)))
        .map(([dk]) => dk)
    )

    let count = 0
    days.forEach(date => {
      const dow = date.getDay()
      if (dow === 0 || dow === 6) return // skip weekends
      if (rangeStart && date < rangeStart) return // before first day of school
      if (rangeEnd   && date > rangeEnd)   return // after last day of school
      const dk = formatDateKey(date)
      if (!noSchoolDates.has(dk)) count++
    })
    return count
  }, [days, events, categories, monthKey, settings.firstDayOfSchool, settings.lastDayOfSchool])

  const HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', shabbatLabel.slice(0, 3).toUpperCase()]

  // Build week grid
  const grid = useMemo(() => {
    const cells = Array(42).fill(null)
    days.forEach(date => { cells[startDow + date.getDate() - 1] = date })
    return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  }, [days, startDow])

  const hasAnyDay = (week) => week.some(d => d !== null)

  // Compute banner segments for this month
  // A banner segment = { label, color, weekRow, startCol, endCol, isContinuation }
  const bannerSegments = useMemo(() => {
    // Gather all banner events in this month grouped by label+category
    const groups = {}
    days.forEach(date => {
      const dk = formatDateKey(date)
      const dayEvs = events[dk] || []
      dayEvs.filter(e => e.banner).forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        if (!groups[key]) {
          const cat = categories.find(c => c.id === ev.category)
          groups[key] = { label: ev.label, color: ev.color || cat?.color || '#999', dates: [] }
        }
        groups[key].dates.push(dk)
      })
    })

    // Check if this banner started before this month (for "↳" prefix)
    const prevMonthEnd = new Date(year, month, 0) // last day of prev month
    const prevMonthKey = formatDateKey(prevMonthEnd)

    const segments = []
    Object.values(groups).forEach(({ label, color, dates }) => {
      const sorted = [...new Set(dates)].sort()

      // Check continuation from previous month
      const firstDateOfMonth = formatDateKey(new Date(year, month, 1))
      const isContinuation = sorted[0] === firstDateOfMonth && (() => {
        // Check if prev month has the same banner event
        for (const [dk, evs] of Object.entries(events)) {
          if (dk <= prevMonthKey && dk >= `${year - (month === 0 ? 1 : 0)}-${String((month === 0 ? 12 : month)).padStart(2, '0')}-01`) {
            if ((evs || []).some(e => e.banner && e.label === label)) return true
          }
        }
        return false
      })()

      // Split into consecutive runs, then split by week row
      let runStart = 0
      for (let i = 1; i <= sorted.length; i++) {
        const isEnd = i === sorted.length || (
          new Date(sorted[i] + 'T00:00:00') - new Date(sorted[i-1] + 'T00:00:00') > 86400000
        )
        if (!isEnd) continue

        const runDates = sorted.slice(runStart, i)
        runStart = i

        // Map each date to { weekRow, col }
        const positions = runDates.map(dk => {
          const d = new Date(dk + 'T00:00:00')
          const dayNum = d.getDate()
          const cellIdx = startDow + dayNum - 1
          return { weekRow: Math.floor(cellIdx / 7), col: cellIdx % 7 }
        })

        // Split by week row
        let rowStart = 0
        for (let j = 1; j <= positions.length; j++) {
          const isRowEnd = j === positions.length || positions[j].weekRow !== positions[j-1].weekRow
          if (!isRowEnd) continue
          const rowPositions = positions.slice(rowStart, j)
          rowStart = j
          segments.push({
            label,
            color,
            weekRow: rowPositions[0].weekRow,
            startCol: rowPositions[0].col,
            endCol: rowPositions[rowPositions.length - 1].col,
            isContinuation: isContinuation && rowPositions[0].col === 0 && rowPositions[0].weekRow === 0,
          })
        }
      }
    })
    return segments
  }, [days, events, categories, startDow, year, month])

  const handleReset = () => {
    if (readOnly) return
    if (confirm(`Reset ${MONTH_NAMES[month]} ${year} to default events?`)) {
      dispatch({ type: 'RESET_MONTH', year, month })
    }
  }

  // Track week row DOM refs for banner positioning
  const weekRefs = useRef([])

  const isCompact = settings.template === 'compact'
  const isMinimal = settings.template === 'minimal'

  return (
    <div className="month-block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Month header */}
      <div
        className={`px-3 flex items-center justify-between ${isCompact ? 'py-1' : 'py-2'}`}
        style={{ backgroundColor: isMinimal ? '#64748b' : 'var(--color-primary)' }}
      >
        <div>
          <h3 className="text-white font-bold text-sm leading-tight">
            {MONTH_NAMES[month]} <span className="font-normal opacity-80">{year}</span>
          </h3>
          {hebrewLabel && !isMinimal && (
            <p className="text-[10px] leading-none" style={{ color: 'var(--color-header-sub)' }}>{hebrewLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {eventCount > 0 && (
            <span className="bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {eventCount}
            </span>
          )}
          <span
            className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            title={`${monthSchoolDays} school day${monthSchoolDays !== 1 ? 's' : ''} this month`}
          >
            📚 {monthSchoolDays}d
          </span>
          {!readOnly && (
            <button
              onClick={handleReset}
              className="text-white/40 hover:text-white/80 text-[10px] transition"
              title="Reset to default events"
            >↺</button>
          )}
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 overflow-hidden">
        {HEADERS.map((h, i) => (
          <div
            key={h}
            className="text-center text-[10px] font-bold py-1 uppercase tracking-tight"
            style={i === 6 && settings.shabbatHighlight ? {
              color: 'var(--color-primary)',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
            } : { color: '#9ca3af' }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="p-1 space-y-0.5">
        {grid.map((week, wi) => {
          if (!hasAnyDay(week)) return null
          const rowSegments = bannerSegments.filter(s => s.weekRow === wi)
          const hasBanners = rowSegments.length > 0
          return (
            <div
              key={wi}
              ref={el => weekRefs.current[wi] = el}
              className={`relative grid grid-cols-7 gap-0.5${hasBanners ? ' pb-4' : ''}`}
            >
              {week.map((date, di) =>
                date ? (
                  <DayCell
                    key={di}
                    date={date}
                    onOpenModal={onOpenModal}
                    focusedDate={focusedDate}
                    settings={settings}
                  />
                ) : (
                  <div key={di} className={`min-h-[36px] sm:min-h-[44px] rounded ${di === 6 && settings.shabbatHighlight ? 'bg-[#2E86AB]/5' : ''}`} />
                )
              )}

              {/* Banner overlays — bottom of week row, readable height */}
              {rowSegments.map((seg, si) => {
                const totalCols = 7
                const leftPct = (seg.startCol / totalCols) * 100
                const widthPct = ((seg.endCol - seg.startCol + 1) / totalCols) * 100
                const displayLabel = seg.isContinuation ? `\u21b3 ${seg.label}` : seg.label
                return (
                  <div
                    key={si}
                    className="absolute pointer-events-none z-10 flex items-center px-2 overflow-hidden shadow-sm"
                    style={{
                      left: `calc(${leftPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                      bottom: '2px',
                      height: '14px',
                      backgroundColor: seg.color,
                      borderRadius: '4px',
                      opacity: 0.95,
                    }}
                  >
                    <span className="text-white font-bold truncate drop-shadow-sm" style={{ fontSize: '8px', lineHeight: 1, letterSpacing: '0.02em' }}>
                      {displayLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Notes strip */}
      {settings.eventsPanel !== 'bottom' && (
        <div className="px-2 pb-2">
          <NotesStrip year={year} month={month} onOpenModal={onOpenModal} />
        </div>
      )}
    </div>
  )
}
