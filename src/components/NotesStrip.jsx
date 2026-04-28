import React, { useMemo, useState } from 'react'
import { formatDateKey, groupConsecutiveDates, formatRangeLabel, parseDateKey } from '../utils/dateUtils.js'
import { useCalendar } from '../context/CalendarContext.jsx'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function NotesStrip({ year, month, onOpenModal }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { events, categories, settings } = state
  const [collapsed, setCollapsed] = useState(false)

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthNote = settings.monthNotes?.[monthKey] || ''
  const monthName = MONTH_NAMES[month]

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
        // Use the first date for clicking
        const firstDateKey = sorted[0]
        return { ev, cat, rangeStr, firstDateKey }
      })
  }, [events, monthKey, categories])

  const handleMonthNoteChange = (e) => {
    if (readOnly) return
    dispatch({ type: 'SET_MONTH_NOTE', monthKey, note: e.target.value })
  }

  // Open modal for first day of this month to add a new event
  const handleAddEvent = () => {
    if (!onOpenModal) return
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
    onOpenModal(firstDay)
  }

  if (noteGroups.length === 0 && !monthNote) return null

  return (
    <div className="notes-strip mt-1 border-t border-gray-200 dark:border-gray-700 pt-1">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 mb-0.5"
      >
        <span className="font-semibold uppercase tracking-wide">{monthName}</span>
        <div className="flex items-center gap-1">
          {!readOnly && onOpenModal && (
            <span
              onClick={e => { e.stopPropagation(); handleAddEvent() }}
              className="text-[10px] text-blue-400 hover:text-blue-600 font-bold px-1 rounded transition"
              title={`Add event to ${monthName}`}
            >＋</span>
          )}
          <span>{collapsed ? '▸' : '▾'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="space-y-0.5">
          {noteGroups.map((group, i) => (
            <button
              key={i}
              className="flex items-start gap-1 text-[10px] leading-snug w-full text-left hover:bg-blue-50 dark:hover:bg-gray-700 rounded px-0.5 transition group"
              onClick={() => onOpenModal && group.firstDateKey && onOpenModal(group.firstDateKey)}
              title={`Open ${group.firstDateKey}`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mt-0.5 shrink-0"
                style={{ background: group.ev.color || group.cat?.color || '#999' }}
              />
              <span className="text-gray-600 dark:text-gray-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition">
                <span className="font-medium">{group.rangeStr}</span>
                {' | '}
                {group.ev.label}
                {group.ev.regularDismissal && (
                  <span className="ml-1">(reg. dismissal)</span>
                )}
              </span>
            </button>
          ))}

          {/* Free-text month note */}
          {!readOnly ? (
            <textarea
              value={monthNote}
              onChange={handleMonthNoteChange}
              placeholder={`Add a note for ${monthName}...`}
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
