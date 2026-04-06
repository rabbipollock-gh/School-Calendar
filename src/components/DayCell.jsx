import React, { useState, useRef, useCallback } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { formatDateKey } from '../utils/dateUtils.js'
import { ROSH_CHODESH_MAP } from '../data/hebrewCalendar.js'

const TOOLTIP_DELAY = 500

export default function DayCell({ date, onOpenModal, focusedDate, settings }) {
  const { state } = useCalendar()
  const { events, categories } = state

  const dateKey = formatDateKey(date)
  const dayNum = date.getDate()
  const dow = date.getDay()
  const isSha = dow === 6
  const dayEvents = events[dateKey] || []
  const nonRCEvents = dayEvents.filter(e => e.category !== 'rosh-chodesh')
  const hasConflict = nonRCEvents.length > 1
  const isFocused = focusedDate === dateKey
  const rcMonth = ROSH_CHODESH_MAP[dateKey]

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const [showTooltip, setShowTooltip] = useState(false)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)
  const cellRef = useRef(null)
  const tooltipTimerRef = useRef(null)

  const handleMouseEnter = useCallback(() => {
    if (dayEvents.length === 0) return
    // Detect if tooltip would clip off-screen (tooltip is w-48 = 192px wide)
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect()
      setFlipX(rect.right + 220 > window.innerWidth)
      setFlipY(rect.bottom + 150 > window.innerHeight)
    }
    tooltipTimerRef.current = setTimeout(() => setShowTooltip(true), TOOLTIP_DELAY)
  }, [dayEvents.length])

  const handleMouseLeave = useCallback(() => {
    clearTimeout(tooltipTimerRef.current)
    setShowTooltip(false)
  }, [])

  const visibleCats = categories.filter(c => !c.visible).map(c => c.id)
  const visibleEvents = dayEvents.filter(e => !visibleCats.includes(e.category))
  const nonBannerEvents = visibleEvents.filter(e => !e.banner)

  const isFilled = settings.cellStyle === 'filled' && nonBannerEvents.length > 0
  const fillColor = isFilled
    ? (nonBannerEvents[0].color || catMap[nonBannerEvents[0].category]?.color || '#999')
    : null

  const isCompact = settings.template === 'compact'
  const isMinimal = settings.template === 'minimal'

  return (
    <button
      ref={cellRef}
      className={`
        day-cell relative flex flex-col items-start p-0.5 sm:p-1
        ${isCompact ? 'min-h-[28px] sm:min-h-[34px]' : isMinimal ? 'min-h-[48px] sm:min-h-[60px]' : 'min-h-[36px] sm:min-h-[44px]'}
        rounded transition-all duration-150 text-left w-full
        ${!isFilled && isSha && settings.shabbatHighlight ? 'sha-col bg-[#1e3a5f]/8 dark:bg-[#1e3a5f]/20' : ''}
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
        ${isCompact ? 'text-[9px] sm:text-[10px]' : 'text-[11px] sm:text-xs'} font-semibold leading-none
        ${isFilled
          ? 'text-white drop-shadow-sm'
          : isSha && settings.shabbatHighlight
            ? 'text-[#2E86AB] dark:text-[#5ba8c7]'
            : 'text-gray-700 dark:text-gray-300'}
      `}>
        {dayNum}
      </span>

      {/* Event dots — dot mode, non-banner events only */}
      {!isFilled && (
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {nonBannerEvents.slice(0, 3).map((ev, i) => {
            const cat = catMap[ev.category]
            const color = ev.color || cat?.color || '#999'
            return (
              <span
                key={ev.id || i}
                className={`event-dot inline-block rounded-full ${isCompact ? 'w-1 h-1' : 'w-1.5 h-1.5'}`}
                style={{ background: color }}
              />
            )
          })}
          {nonBannerEvents.length > 3 && (
            <span className="text-[8px] text-gray-400 leading-none">+{nonBannerEvents.length - 3}</span>
          )}
        </div>
      )}

      {/* Multi-event badge — filled mode */}
      {isFilled && nonBannerEvents.length > 1 && (
        <span className="text-[8px] text-white/80 leading-none mt-0.5">+{nonBannerEvents.length - 1}</span>
      )}

      {/* Rosh Chodesh badge */}
      {rcMonth && (
        <span className={`
          text-[7px] leading-none font-medium mt-auto truncate max-w-full
          ${isFilled ? 'text-white/80' : 'text-purple-500/70 dark:text-purple-400/60'}
        `}>
          🌙 {rcMonth}
        </span>
      )}

      {/* Conflict badge */}
      {hasConflict && !isFilled && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-400 rounded-full" title="Multiple events" />
      )}

      {/* Hover tooltip — smart positioning */}
      {showTooltip && dayEvents.length > 0 && (
        <div className={`
          absolute z-30 mb-1 mt-1 w-48 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-2 space-y-1 pointer-events-none
          ${flipY ? 'top-full bottom-auto' : 'bottom-full top-auto'}
          ${flipX ? 'right-0 left-auto' : 'left-0 right-auto'}
        `}>
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
