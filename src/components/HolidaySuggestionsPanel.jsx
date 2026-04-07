import React, { useMemo } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { getHolidaySuggestions } from '../data/hebrewCalendar.js'
import { parseDateKey } from '../utils/dateUtils.js'
import { nanoid } from '../utils/nanoid.js'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function HolidaySuggestionsPanel({ isOpen, onClose, onOpenModal }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { events, categories } = state

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  // Check which holidays are already on the calendar
  const addedKeys = useMemo(() => {
    const keys = new Set()
    Object.entries(events).forEach(([dateKey, evs]) => {
      ;(evs || []).forEach(ev => keys.add(`${dateKey}::${ev.label}`))
    })
    return keys
  }, [events])

  const isAdded = (holiday) => {
    return addedKeys.has(`${holiday.date}::${holiday.label}`)
  }

  const handleAdd = (holiday) => {
    if (readOnly) return
    dispatch({
      type: 'ADD_EVENT',
      dateKey: holiday.date,
      event: { id: 'hol-' + nanoid(), category: holiday.category, label: holiday.label },
    })
  }

  // Group by month
  const grouped = useMemo(() => {
    const groups = {}
    getHolidaySuggestions(state.settings.academicYear).forEach(h => {
      const monthKey = h.date.slice(0, 7)
      if (!groups[monthKey]) groups[monthKey] = []
      groups[monthKey].push(h)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        id="holiday-suggestions-panel"
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div className="px-5 py-4 bg-[#6b4fa8] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">✡️ Holiday Suggestions</h2>
            <p className="text-white/70 text-xs">5787 / 2026–2027 Jewish holidays</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {grouped.map(([monthKey, holidays]) => {
            const [y, m] = monthKey.split('-')
            const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
            return (
              <div key={monthKey}>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">{monthName}</h3>
                <div className="space-y-1.5">
                  {holidays.map(h => {
                    const added = isAdded(h)
                    const cat = catMap[h.category]
                    const date = parseDateKey(h.date)
                    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

                    return (
                      <div
                        key={h.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                          added
                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 opacity-70'
                            : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: cat?.color || '#C3B1E1' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{h.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{dateStr} · {h.hebrewDate}</p>
                        </div>
                        {added ? (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">✓ Added</span>
                        ) : (
                          <button
                            onClick={() => handleAdd(h)}
                            className="shrink-0 text-xs bg-[#6b4fa8] hover:bg-[#5a3f8f] text-white px-3 py-1 rounded-lg transition font-medium"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
