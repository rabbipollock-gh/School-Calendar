import React, { useMemo } from 'react'
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

  // Count events in this month
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const eventCount = useMemo(() => {
    return Object.entries(events)
      .filter(([dk]) => dk.startsWith(monthKey))
      .reduce((sum, [, evs]) => sum + (evs?.length || 0), 0)
  }, [events, monthKey])

  // Column headers
  const HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', shabbatLabel.slice(0, 3).toUpperCase()]

  // Build week grid: array of 6 weeks × 7 days (null for empty slots)
  const grid = useMemo(() => {
    const cells = Array(42).fill(null)
    days.forEach(date => {
      cells[startDow + date.getDate() - 1] = date
    })
    return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  }, [days, startDow])

  const hasAnyDay = (week) => week.some(d => d !== null)

  const handleReset = () => {
    if (readOnly) return
    if (confirm(`Reset ${MONTH_NAMES[month]} ${year} to default events?`)) {
      dispatch({ type: 'RESET_MONTH', year, month })
    }
  }

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
            >
              ↺
            </button>
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
              ${i === 6 && settings.shabbatHighlight ? 'text-[#2E86AB] dark:text-[#5ba8c7] bg-[#2E86AB]/5' : 'text-gray-400 dark:text-gray-500'}
            `}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="p-1 space-y-0.5">
        {grid.map((week, wi) =>
          hasAnyDay(week) ? (
            <div key={wi} className="grid grid-cols-7 gap-0.5">
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
            </div>
          ) : null
        )}
      </div>

      {/* Notes strip — hidden when events panel is at bottom of page */}
      {settings.eventsPanel !== 'bottom' && (
        <div className="px-2 pb-2">
          <NotesStrip year={year} month={month} onOpenModal={onOpenModal} />
        </div>
      )}
    </div>
  )
}
