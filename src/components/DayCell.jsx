import React, { useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { formatDateKey, isShabbat, parseDateKey } from '../utils/dateUtils.js'

const TOOLTIP_DELAY = 500

export default function DayCell({ date, onOpenModal, focusedDate, settings }) {
  const { state } = useCalendar()
  const { events, categories } = state

  const dateKey = formatDateKey(date)
  const dayNum = date.getDate()
  const dow = date.getDay() // 0=Sun, 6=Sat
  const isSha = dow === 6
  const dayEvents = events[dateKey] || []
  const hasConflict = dayEvents.length > 1
  const isFocused = focusedDate === dateKey

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const [showTooltip, setShowTooltip] = useState(false)
  let tooltipTimer = null

  const handleMouseEnter = () => {
    if (dayEvents.length === 0) return
    tooltipTimer = setTimeout(() => setShowTooltip(true), TOOLTIP_DELAY)
  }
  const handleMouseLeave = () => {
    clearTimeout(tooltipTimer)
    setShowTooltip(false)
  }

  const visibleCats = categories.filter(c => !c.visible).map(c => c.id)
  const visibleEvents = dayEvents.filter(e => !visibleCats.includes(e.category))

  const isFilled = settings.cellStyle === 'filled' && visibleEvents.length > 0
  const fillColor = isFilled
    ? (visibleEvents[0].color || catMap[visibleEvents[0].category]?.color || '#999')
    : null

  return (
    <button
      className={`
        day-cell relative flex flex-col items-start p-0.5 sm:p-1 min-h-[36px] sm:min-h-[44px]
        rounded transition-all duration-150 text-left w-full
        ${!isFilled && isSha && settings.shabbatHighlight ? 'sha-col bg-[#2E86AB]/10 dark:bg-[#2E86AB]/20' : ''}
        ${!isFilled ? 'bg-white dark:bg-gray-800' : ''}
        ${isFocused ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        ${hasConflict && !isFilled ? 'ring-1 ring-amber-400' : ''}
        hover:opacity-90 hover:shadow-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500
      `}
      style={isFilled ? { backgroundColor: fillColor } : undefined}
      onClick={() => onOpenModal(dateKey)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-date={dateKey}
      tabIndex={isFocused ? 0 : -1}
      aria-label={`${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ''}`}
    >
      {/* Day number */}
      <span className={`
        text-[11px] sm:text-xs font-semibold leading-none
        ${isFilled
          ? 'text-white drop-shadow-sm'
          : isSha && settings.shabbatHighlight
            ? 'text-[#2E86AB] dark:text-[#5ba8c7]'
            : 'text-gray-700 dark:text-gray-300'}
      `}>
        {dayNum}
      </span>

      {/* Event dots — dot mode only */}
      {!isFilled && (
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {visibleEvents.slice(0, 3).map((ev, i) => {
            const cat = catMap[ev.category]
            const color = ev.color || cat?.color || '#999'
            return (
              <span
                key={ev.id || i}
                className="event-dot inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
              />
            )
          })}
          {visibleEvents.length > 3 && (
            <span className="text-[8px] text-gray-400 leading-none">+{visibleEvents.length - 3}</span>
          )}
        </div>
      )}

      {/* Multi-event badge — filled mode */}
      {isFilled && visibleEvents.length > 1 && (
        <span className="text-[8px] text-white/80 leading-none mt-0.5">+{visibleEvents.length - 1}</span>
      )}

      {/* Conflict badge */}
      {hasConflict && !isFilled && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-400 rounded-full" title="Multiple events" />
      )}

      {/* Hover tooltip */}
      {showTooltip && dayEvents.length > 0 && (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-48 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-2 space-y-1 pointer-events-none">
          {dayEvents.map((ev, i) => {
            const cat = catMap[ev.category]
            const color = ev.color || cat?.color || '#999'
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="truncate">{ev.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </button>
  )
}
