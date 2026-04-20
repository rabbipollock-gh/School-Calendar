import React, { useRef, useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import MonthBlock from './MonthBlock.jsx'
import MonthEventsPanel from './MonthEventsPanel.jsx'

export default function CalendarGrid({ onOpenModal, focusedDate, highlightDate }) {
  const { state, academicMonths } = useCalendar()
  const { settings } = state

  // Mobile: single-month swipe view
  const [mobileMonthIdx, setMobileMonthIdx] = useState(() => {
    const now = new Date()
    const idx = academicMonths.findIndex(m => m.year === now.getFullYear() && m.month === now.getMonth())
    return idx >= 0 ? idx : 0
  })

  // Reset mobile month index when academic year changes
  React.useEffect(() => {
    setMobileMonthIdx(0)
  }, [academicMonths])

  const scrollToDate = (dateKey) => {
    if (!dateKey) return
    setTimeout(() => {
      const el = document.querySelector(`[data-date="${dateKey}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  // Expose scroll for parent
  React.useEffect(() => {
    if (highlightDate) scrollToDate(highlightDate)
  }, [highlightDate])

  return (
    <>
      {/* Desktop: 4-column grid, column-first order (Aug/Sep/Oct in col 1, etc.) */}
      <div
        id="calendar-grid"
        className="hidden md:grid grid-cols-4 gap-4 p-4"
      >
        {academicMonths.map(({ year, month }) => (
            <MonthBlock
              key={`${year}-${month}`}
              year={year}
              month={month}
              onOpenModal={onOpenModal}
              focusedDate={focusedDate}
            />
          ))}
      </div>

      {/* Bottom events panel (desktop) */}
      {settings.eventsPanel === 'bottom' && (
        <MonthEventsPanel onOpenModal={onOpenModal} />
      )}

      {/* Mobile: single-month with prev/next nav */}
      <div className="md:hidden flex flex-col h-full">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-[56px] z-30">
          <button
            onClick={() => setMobileMonthIdx(i => Math.max(0, i - 1))}
            disabled={mobileMonthIdx === 0}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
          >‹</button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][academicMonths[mobileMonthIdx].month]}
            {' '}{academicMonths[mobileMonthIdx].year}
          </span>
          <button
            onClick={() => setMobileMonthIdx(i => Math.min(academicMonths.length - 1, i + 1))}
            disabled={mobileMonthIdx === academicMonths.length - 1}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
          >›</button>
        </div>

        {/* Month dots indicator */}
        <div className="flex justify-center gap-1 py-1.5 bg-white dark:bg-gray-800">
          {academicMonths.map((_, i) => (
            <button
              key={i}
              onClick={() => setMobileMonthIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition ${i === mobileMonthIdx ? 'bg-[#1e3a5f] dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}`}
            />
          ))}
        </div>

        {/* Single month view */}
        <div className="flex-1 overflow-y-auto p-3">
          <MonthBlock
            key={`${academicMonths[mobileMonthIdx].year}-${academicMonths[mobileMonthIdx].month}`}
            year={academicMonths[mobileMonthIdx].year}
            month={academicMonths[mobileMonthIdx].month}
            onOpenModal={onOpenModal}
            focusedDate={focusedDate}
          />
        </div>
      </div>
    </>
  )
}
