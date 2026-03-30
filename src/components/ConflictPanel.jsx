import React, { useMemo, useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { parseDateKey } from '../utils/dateUtils.js'

export default function ConflictPanel({ isOpen, onClose, onJumpToDate }) {
  const { state, dispatch } = useCalendar()
  const { events, categories, settings } = state
  const [resolvingDate, setResolvingDate] = useState(null)

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const acknowledged = new Set(settings.acknowledgedConflicts || [])

  const conflicts = useMemo(() => {
    return Object.entries(events)
      .filter(([dateKey, evs]) => {
        if (acknowledged.has(dateKey)) return false
        const nonRC = (evs || []).filter(e => e.category !== 'rosh-chodesh')
        return nonRC.length > 1
      })
      .map(([dateKey, evs]) => ({ dateKey, events: evs.filter(e => e.category !== 'rosh-chodesh') }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  }, [events, settings.acknowledgedConflicts])

  const handleAcknowledge = (dateKey) => {
    dispatch({ type: 'ACKNOWLEDGE_CONFLICT', dateKey })
    if (resolvingDate === dateKey) setResolvingDate(null)
  }

  const handleKeep = (dateKey, keepId) => {
    const dayEvs = events[dateKey] || []
    dayEvs.forEach(ev => {
      if (ev.id !== keepId) dispatch({ type: 'DELETE_EVENT', dateKey, eventId: ev.id })
    })
    setResolvingDate(null)
  }

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
            const isResolving = resolvingDate === dateKey
            return (
              <div
                key={dateKey}
                className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 overflow-hidden"
              >
                {/* Date header + actions */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <button
                    onClick={() => { onJumpToDate?.(dateKey); onClose() }}
                    className="text-sm font-semibold text-amber-800 dark:text-amber-300 hover:underline text-left"
                  >
                    {dateStr}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">{dayEvs.length} events</span>
                    <button
                      onClick={() => setResolvingDate(isResolving ? null : dateKey)}
                      className="text-xs px-2 py-0.5 rounded-full bg-[#1e3a5f] text-white hover:bg-[#2a4d7a] transition"
                      title="Pick which event to keep"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleAcknowledge(dateKey)}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition"
                      title="Keep both events and dismiss this warning"
                    >
                      Ignore
                    </button>
                  </div>
                </div>

                {/* Event list */}
                <div className="px-3 pb-2 space-y-1">
                  {dayEvs.map((ev) => {
                    const cat = catMap[ev.category]
                    const color = ev.color || cat?.color || '#999'
                    return (
                      <div key={ev.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="flex-1 truncate">{ev.label}</span>
                        <span className="text-gray-400">{cat?.name || ev.category}</span>
                        {isResolving && (
                          <button
                            onClick={() => handleKeep(dateKey, ev.id)}
                            className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500 text-white hover:bg-green-600 transition shrink-0"
                          >
                            Keep
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Resolve hint */}
                {isResolving && (
                  <div className="px-3 pb-2.5 text-[10px] text-amber-700 dark:text-amber-400">
                    Click "Keep" next to the event you want to keep — the others will be removed.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
