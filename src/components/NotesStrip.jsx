import React, { useMemo, useState } from 'react'
import { formatDateKey, groupConsecutiveDates, formatRangeLabel, parseDateKey } from '../utils/dateUtils.js'
import { useCalendar } from '../context/CalendarContext.jsx'

export default function NotesStrip({ year, month }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { events, categories, settings } = state
  const [collapsed, setCollapsed] = useState(false)

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthNote = settings.monthNotes?.[monthKey] || ''

  // Build notes from events — group by label+category, then group consecutive dates
  const noteGroups = useMemo(() => {
    const byEvent = {}
    Object.entries(events).forEach(([dateKey, dayEvs]) => {
      if (!dateKey.startsWith(monthKey)) return
      ;(dayEvs || []).forEach(ev => {
        const key = `${ev.category}::${ev.label}`
        if (!byEvent[key]) byEvent[key] = { ev, dates: [] }
        byEvent[key].dates.push(dateKey)
      })
    })

    return Object.values(byEvent)
      .sort((a, b) => a.dates[0].localeCompare(b.dates[0]))
      .map(({ ev, dates }) => {
        const sorted = [...dates].sort()
        const groups = groupConsecutiveDates(sorted)
        const rangeStr = groups.map(g => formatRangeLabel(g)).join(', ')
        const cat = catMap[ev.category]
        return { ev, cat, rangeStr }
      })
  }, [events, monthKey, categories])

  const handleMonthNoteChange = (e) => {
    if (readOnly) return
    dispatch({ type: 'SET_MONTH_NOTE', monthKey, note: e.target.value })
  }

  if (noteGroups.length === 0 && !monthNote) return null

  return (
    <div className="notes-strip mt-1 border-t border-gray-200 dark:border-gray-700 pt-1">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 mb-0.5"
      >
        <span className="font-semibold uppercase tracking-wide">Notes</span>
        <span>{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="space-y-0.5">
          {noteGroups.map((group, i) => (
            <div key={i} className="flex items-start gap-1 text-[10px] leading-snug">
              <span
                className="inline-block w-2 h-2 rounded-full mt-0.5 shrink-0"
                style={{ background: group.ev.color || group.cat?.color || '#999' }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                <span className="font-medium">{group.rangeStr}</span>
                {' | '}
                {group.ev.label}
              </span>
            </div>
          ))}

          {/* Free-text month note */}
          {!readOnly ? (
            <textarea
              value={monthNote}
              onChange={handleMonthNoteChange}
              placeholder="Add a note for this month..."
              rows={monthNote ? undefined : 1}
              className="w-full text-[10px] text-gray-500 dark:text-gray-400 bg-transparent border border-dashed border-gray-200 dark:border-gray-700 rounded px-1.5 py-1 resize-none outline-none focus:border-blue-300 mt-1 placeholder-gray-300"
            />
          ) : monthNote ? (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 italic">{monthNote}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
