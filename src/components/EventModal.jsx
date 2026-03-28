import React, { useState, useCallback } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { nanoid } from '../utils/nanoid.js'
import { formatDateKey, parseDateKey } from '../utils/dateUtils.js'

export default function EventModal({ dateKey, onClose }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { events, categories, settings } = state

  const dayEvents = events[dateKey] || []
  const catMap = {}
  categories.filter(c => c.visible).forEach(c => { catMap[c.id] = c })

  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState(categories.find(c => c.visible)?.id || '')
  const [newTime, setNewTime] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(false)

  const date = parseDateKey(dateKey)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const isSha = date.getDay() === 6

  const checkDuplicate = (label) => {
    return dayEvents.some(e => e.label.toLowerCase() === label.toLowerCase().trim())
  }

  const handleAdd = () => {
    if (!newLabel.trim() || readOnly) return
    if (checkDuplicate(newLabel)) {
      setDuplicateWarning(true)
      setTimeout(() => setDuplicateWarning(false), 3000)
      return
    }
    dispatch({
      type: 'ADD_EVENT',
      dateKey,
      event: {
        id: 'ev-' + nanoid(),
        category: newCategory,
        label: newLabel.trim(),
        time: newTime || undefined,
      },
    })
    setNewLabel('')
    setNewTime('')
  }

  const handleDelete = (eventId) => {
    if (readOnly) return
    dispatch({ type: 'DELETE_EVENT', dateKey, eventId })
  }

  const handleEditStart = (ev) => {
    if (readOnly) return
    setEditingId(ev.id)
    setEditLabel(ev.label)
  }

  const handleEditSave = (eventId) => {
    if (editLabel.trim()) {
      dispatch({ type: 'EDIT_EVENT', dateKey, eventId, changes: { label: editLabel.trim() } })
    }
    setEditingId(null)
  }

  const handleColorChange = (eventId, color) => {
    if (readOnly) return
    dispatch({ type: 'EDIT_EVENT', dateKey, eventId, changes: { color } })
  }

  const handleTimeChange = (eventId, time) => {
    if (readOnly) return
    dispatch({ type: 'EDIT_EVENT', dateKey, eventId, changes: { time: time || undefined } })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-4 flex items-start justify-between"
          style={{ background: isSha ? '#2E86AB' : '#1e3a5f' }}
        >
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">
              {isSha ? `${settings.shabbatLabel} ✡` : ''}
            </p>
            <h2 className="text-white font-bold text-lg leading-snug">{dateStr}</h2>
            <p className="text-white/60 text-xs mt-0.5">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none transition">×</button>
        </div>

        {/* Events list */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto space-y-2">
          {dayEvents.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No events — add one below</p>
          )}
          {dayEvents.map(ev => {
            const cat = catMap[ev.category]
            const displayColor = ev.color || cat?.color || '#999'
            return (
              <div
                key={ev.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 group"
              >
                {/* Category color dot / color picker */}
                <div className="relative shrink-0">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow cursor-pointer"
                    style={{ background: displayColor }}
                    title="Click to change event color"
                    onClick={() => {
                      if (!readOnly) {
                        const input = document.createElement('input')
                        input.type = 'color'
                        input.value = displayColor
                        input.onchange = (e) => handleColorChange(ev.id, e.target.value)
                        input.click()
                      }
                    }}
                  />
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  {editingId === ev.id && !readOnly ? (
                    <input
                      autoFocus
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onBlur={() => handleEditSave(ev.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(ev.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="w-full text-sm border-b border-blue-400 outline-none bg-transparent dark:text-white"
                    />
                  ) : (
                    <button
                      className="text-sm text-gray-800 dark:text-gray-100 text-left w-full truncate hover:text-blue-600 transition"
                      onClick={() => handleEditStart(ev)}
                      title={readOnly ? ev.label : 'Click to rename'}
                    >
                      {ev.label}
                    </button>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{cat?.name || ev.category}</span>
                    {!readOnly && (
                      <input
                        type="time"
                        value={ev.time || ''}
                        onChange={e => handleTimeChange(ev.id, e.target.value)}
                        className="text-xs text-gray-500 border border-gray-200 rounded px-1 py-0.5 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                        title="Event time (used in ICS export)"
                      />
                    )}
                    {ev.time && readOnly && (
                      <span className="text-xs text-gray-400">@ {ev.time}</span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(ev.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition text-lg leading-none"
                    title="Delete event"
                  >×</button>
                )}
              </div>
            )
          })}
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="mx-5 mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs flex items-center gap-2">
            ⚠️ An event with that name already exists on this day. Add anyway?
            <button
              className="ml-auto underline font-medium"
              onClick={() => {
                setDuplicateWarning(false)
                dispatch({
                  type: 'ADD_EVENT',
                  dateKey,
                  event: { id: 'ev-' + nanoid(), category: newCategory, label: newLabel.trim(), time: newTime || undefined },
                })
                setNewLabel('')
                setNewTime('')
              }}
            >Add anyway</button>
          </div>
        )}

        {/* Add new event */}
        {!readOnly && (
          <div className="px-5 pt-2 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Add Event</p>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
            >
              {categories.filter(c => c.visible).map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Event label..."
                className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="time"
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
                className="w-28 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                title="Optional time (for ICS export)"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!newLabel.trim()}
              className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg font-semibold text-sm transition"
            >
              + Add Event
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
