import React, { useMemo } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { parseDateKey } from '../utils/dateUtils.js'

export default function ConflictPanel({ isOpen, onClose, onJumpToDate }) {
  const { state } = useCalendar()
  const { events, categories } = state

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const conflicts = useMemo(() => {
    return Object.entries(events)
      .filter(([, evs]) => Array.isArray(evs) && evs.length > 1)
      .map(([dateKey, evs]) => ({ dateKey, events: evs }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  }, [events])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 bg-amber-500 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Schedule Conflicts</h2>
            <p className="text-white/80 text-xs">{conflicts.length} day{conflicts.length !== 1 ? 's' : ''} with multiple events</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {conflicts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-3xl mb-2">✅</p>
              <p>No scheduling conflicts</p>
            </div>
          )}
          {conflicts.map(({ dateKey, events: dayEvs }) => {
            const date = parseDateKey(dateKey)
            const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            return (
              <button
                key={dateKey}
                onClick={() => { onJumpToDate?.(dateKey); onClose() }}
                className="w-full text-left p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{dateStr}</span>
                  <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">{dayEvs.length} events</span>
                </div>
                <div className="space-y-1">
                  {dayEvs.map((ev, i) => {
                    const cat = catMap[ev.category]
                    const color = ev.color || cat?.color || '#999'
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        {ev.label}
                        <span className="text-gray-400 ml-auto">{cat?.name || ev.category}</span>
                      </div>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
