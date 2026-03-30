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

  return (
    <div className="month-block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Month header */}
      <div className="bg-[#1e3a5f] dark:bg-[#0f2744] px-3 py-2 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm leading-tight">
            {MONTH_NAMES[month]} <span className="font-normal opacity-80">{year}</span>
          </h3>
          {hebrewLabel && (
            <p className="text-[#93c5fd] text-[10px] leading-none">{hebrewLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {eventCount > 0 && (
            <span className="bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {eventCount}
            </span>
          )}
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
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
        {HEADERS.map((h, i) => (
          <div
            key={h}
            className={`
              text-center text-[10px] font-bold py-1 uppercase tracking-tight
              ${i === 6 && settings.shabbatHighlight ? 'text-[#1e3a5f] dark:text-[#7ba4d4] bg-[#1e3a5f]/8' : 'text-gray-400 dark:text-gray-500'}
            `}
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
          return (
            <div
              key={wi}
              ref={el => weekRefs.current[wi] = el}
              className="relative grid grid-cols-7 gap-0.5"
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

              {/* Banner overlays for this row */}
              {rowSegments.map((seg, si) => {
                const totalCols = 7
                const leftPct = (seg.startCol / totalCols) * 100
                const widthPct = ((seg.endCol - seg.startCol + 1) / totalCols) * 100
                const displayLabel = seg.isContinuation ? `↳ ${seg.label}` : seg.label
                return (
                  <div
                    key={si}
                    className="absolute pointer-events-none z-10 flex items-center px-1.5 overflow-hidden"
                    style={{
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      top: '2px',
                      height: '7px',
                      backgroundColor: seg.color,
                      borderRadius: '3px',
                      opacity: 0.88,
                    }}
                  >
                    <span className="text-white font-semibold truncate" style={{ fontSize: '6px', lineHeight: 1 }}>
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
