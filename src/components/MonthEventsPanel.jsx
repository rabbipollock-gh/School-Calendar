import React, { useMemo } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { groupConsecutiveDates, formatRangeLabel, formatTime } from '../utils/dateUtils.js'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function MonthEventsPanel({ onOpenModal }) {
  const { state, readOnly, academicMonths } = useCalendar()
  const { events, categories, settings } = state

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  // Build per-month event groups
  const monthData = useMemo(() => {
    return academicMonths.map(({ year, month }) => {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
      const byEvent = {}

      Object.entries(events).forEach(([dateKey, dayEvs]) => {
        if (!dateKey.startsWith(monthKey)) return
        ;(dayEvs || []).forEach(ev => {
          const key = `${ev.category}::${ev.label}::${ev.time || ''}`
          if (!byEvent[key]) byEvent[key] = { ev, dates: [] }
          byEvent[key].dates.push(dateKey)
        })
      })

      const groups = Object.values(byEvent)
        .sort((a, b) => a.dates[0].localeCompare(b.dates[0]))
        .map(({ ev, dates }) => {
          const sorted = [...dates].sort()
          const rangeGroups = groupConsecutiveDates(sorted)
          const rangeStr = rangeGroups.map(g => formatRangeLabel(g)).join(', ')
          const cat = catMap[ev.category]
          return { ev, cat, rangeStr, firstDateKey: sorted[0] }
        })

      return { year, month, monthKey, monthName: MONTH_NAMES[month], groups }
    }).filter(m => m.groups.length > 0)
  }, [events, categories, academicMonths])

  if (monthData.length === 0) return null

  const handleAddToMonth = (year, month) => {
    if (!onOpenModal) return
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
    onOpenModal(firstDay)
  }

  return (
    <div
      className="mt-4 mx-4 mb-6 rounded-xl overflow-hidden shadow-lg"
      style={{ background: 'linear-gradient(135deg, #1a4a5c 0%, #0f2d3d 100%)' }}
    >
      {/* Panel header */}
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3">
        <span className="text-white font-bold text-sm tracking-wide uppercase">Events by Month</span>
        <span className="text-white/40 text-xs">— click any event to open, ＋ to add</span>
      </div>

      {/* Month columns grid — flows top-to-bottom within each column, then spills right */}
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: `repeat(${Math.ceil(monthData.length / 4)}, 1fr)`,
          gridAutoFlow: 'column',
        }}
      >
        {(() => {
          const rows = Math.ceil(monthData.length / 4)
          return monthData.map(({ year, month, monthName, groups }, idx) => {
            // With column-flow, items 0..rows-1 are col 1, rows..2*rows-1 are col 2, etc.
            const colIdx = Math.floor(idx / rows)
            return (
          <div key={`${year}-${month}`} className="p-3 min-w-0" style={colIdx > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.1)' } : undefined}>
            {/* Month heading */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-bold text-xs uppercase tracking-wide truncate">
                {monthName} <span className="font-normal opacity-60">'{String(year).slice(2)}</span>
              </h4>
              {!readOnly && (
                <button
                  onClick={() => handleAddToMonth(year, month)}
                  className="text-white/60 hover:text-white text-sm font-bold leading-none transition ml-1 shrink-0"
                  title={`Add event to ${monthName}`}
                >＋</button>
              )}
            </div>

            {/* Event list */}
            <div className="space-y-1">
              {groups.map((group, i) => (
                <button
                  key={i}
                  onClick={() => onOpenModal && group.firstDateKey && onOpenModal(group.firstDateKey)}
                  className="flex items-start gap-1.5 w-full text-left group hover:bg-white/10 rounded px-1 py-0.5 transition"
                  title={`Open ${group.firstDateKey}`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mt-0.5 shrink-0 ring-1 ring-white/20"
                    style={{ background: group.ev.color || group.cat?.color || '#999' }}
                  />
                  <span className="text-[10px] leading-snug text-white/70 group-hover:text-white transition min-w-0">
                    <span className="text-white/50 mr-1">{group.rangeStr}</span>
                    {group.ev.label}
                    {group.ev.regularDismissal ? (
                      <span className="text-white/45 group-hover:text-white/70"> (reg. dismissal)</span>
                    ) : group.ev.time ? (
                      <span className="text-white/45 group-hover:text-white/70"> {formatTime(group.ev.time)}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
