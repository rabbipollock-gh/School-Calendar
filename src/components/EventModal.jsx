import React, { useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { nanoid } from '../utils/nanoid.js'
import { formatDateKey, parseDateKey, getDateRange } from '../utils/dateUtils.js'
import { ACADEMIC_MONTHS } from '../hooks/useKeyboardNav.js'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Find which ACADEMIC_MONTHS entry contains a dateKey
function findAcademicMonth(dateKey) {
  const [y, m] = dateKey.split('-').map(Number)
  return ACADEMIC_MONTHS.find(am => am.year === y && am.month === m - 1) || ACADEMIC_MONTHS[0]
}

export default function EventModal({ dateKey, onClose }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { events, categories, settings } = state

  const dayEvents = events[dateKey] || []
  const catMap = {}
  categories.filter(c => c.visible).forEach(c => { catMap[c.id] = c })

  // ── Single-event add state ──
  const [addTab, setAddTab] = useState('single')
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState(categories.find(c => c.visible)?.id || '')
  const [newTime, setNewTime] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(false)

  // ── Inline range add state ──
  const startMonth = findAcademicMonth(dateKey)
  const startDay = parseInt(dateKey.split('-')[2], 10)
  const [fromMonth, setFromMonth] = useState(startMonth)
  const [fromDay, setFromDay] = useState(startDay)
  const [toMonth, setToMonth] = useState(startMonth)
  const [toDay, setToDay] = useState(startDay)
  const [rangeCategory, setRangeCategory] = useState(categories.find(c => c.visible)?.id || '')
  const [rangeLabel, setRangeLabel] = useState('')
  const [rangeTime, setRangeTime] = useState('')
  const [rangeSuccess, setRangeSuccess] = useState(null)

  // ── Edit state ──
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  const date = parseDateKey(dateKey)
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const isSha = date.getDay() === 6

  // ── Range helpers ──
  const fromKey = `${fromMonth.year}-${String(fromMonth.month + 1).padStart(2, '0')}-${String(fromDay).padStart(2, '0')}`
  const toKey = `${toMonth.year}-${String(toMonth.month + 1).padStart(2, '0')}-${String(toDay).padStart(2, '0')}`
  let dateRange = []
  try { if (toKey >= fromKey) dateRange = getDateRange(fromKey, toKey) } catch {}

  const daysInFromMonth = new Date(fromMonth.year, fromMonth.month + 1, 0).getDate()
  const daysInToMonth = new Date(toMonth.year, toMonth.month + 1, 0).getDate()

  // ── Handlers ──
  const checkDuplicate = (label) =>
    dayEvents.some(e => e.label.toLowerCase() === label.toLowerCase().trim())

  const handleAdd = () => {
    if (!newLabel.trim() || readOnly) return
    if (checkDuplicate(newLabel)) { setDuplicateWarning(true); setTimeout(() => setDuplicateWarning(false), 3000); return }
    dispatch({ type: 'ADD_EVENT', dateKey, event: { id: 'ev-' + nanoid(), category: newCategory, label: newLabel.trim(), time: newTime || undefined } })
    setNewLabel('')
    setNewTime('')
  }

  const handleAddForce = () => {
    setDuplicateWarning(false)
    dispatch({ type: 'ADD_EVENT', dateKey, event: { id: 'ev-' + nanoid(), category: newCategory, label: newLabel.trim(), time: newTime || undefined } })
    setNewLabel('')
    setNewTime('')
  }

  const handleDelete = (eventId) => { if (!readOnly) dispatch({ type: 'DELETE_EVENT', dateKey, eventId }) }

  const handleEditStart = (ev) => { if (!readOnly) { setEditingId(ev.id); setEditLabel(ev.label) } }
  const handleEditSave = (eventId) => {
    if (editLabel.trim()) dispatch({ type: 'EDIT_EVENT', dateKey, eventId, changes: { label: editLabel.trim() } })
    setEditingId(null)
  }
  const handleColorChange = (eventId, color) => { if (!readOnly) dispatch({ type: 'EDIT_EVENT', dateKey, eventId, changes: { color } }) }
  const handleTimeChange = (eventId, time) => { if (!readOnly) dispatch({ type: 'EDIT_EVENT', dateKey, eventId, changes: { time: time || undefined } }) }
  const handleCategoryChange = (eventId, category) => { if (!readOnly) dispatch({ type: 'EDIT_EVENT', dateKey, eventId, changes: { category, color: undefined } }) }

  const handleRangeSubmit = () => {
    if (!rangeLabel.trim() || dateRange.length === 0 || readOnly) return
    dispatch({ type: 'ADD_RANGE', dateKeys: dateRange, event: { category: rangeCategory, label: rangeLabel.trim(), time: rangeTime || undefined } })
    setRangeSuccess(dateRange.length)
    setRangeLabel('')
    setRangeTime('')
    setTimeout(() => setRangeSuccess(null), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="px-5 py-4 flex items-start justify-between" style={{ background: isSha ? '#2E86AB' : '#1e3a5f' }}>
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">
              {isSha ? `${settings.shabbatLabel} ✡` : ''}
            </p>
            <h2 className="text-white font-bold text-lg leading-snug">{dateStr}</h2>
            <p className="text-white/60 text-xs mt-0.5">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none transition">×</button>
        </div>

        {/* ── Events list ── */}
        <div className="px-5 py-3 max-h-56 overflow-y-auto space-y-2">
          {dayEvents.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No events — add one below</p>
          )}
          {dayEvents.map(ev => {
            const cat = catMap[ev.category]
            const displayColor = ev.color || cat?.color || '#999'
            return (
              <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 group">
                {/* Color dot / picker */}
                <div className="relative shrink-0">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow cursor-pointer"
                    style={{ background: displayColor }}
                    title="Click to change color"
                    onClick={() => {
                      if (!readOnly) {
                        const input = document.createElement('input')
                        input.type = 'color'; input.value = displayColor
                        input.onchange = (e) => handleColorChange(ev.id, e.target.value)
                        input.click()
                      }
                    }}
                  />
                </div>

                {/* Label + meta */}
                <div className="flex-1 min-w-0">
                  {editingId === ev.id && !readOnly ? (
                    <input
                      autoFocus value={editLabel}
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
                    >{ev.label}</button>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    {!readOnly ? (
                      <select
                        value={ev.category}
                        onChange={e => handleCategoryChange(ev.id, e.target.value)}
                        className="text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-800 dark:text-gray-300 outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        {categories.filter(c => c.visible).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">{cat?.name || ev.category}</span>
                    )}
                    {!readOnly && (
                      <input
                        type="time" value={ev.time || ''}
                        onChange={e => handleTimeChange(ev.id, e.target.value)}
                        className="text-xs text-gray-500 border border-gray-200 rounded px-1 py-0.5 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                        title="Event time (used in ICS export)"
                      />
                    )}
                    {ev.time && readOnly && <span className="text-xs text-gray-400">@ {ev.time}</span>}
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
            ⚠️ An event with that name already exists on this day.
            <button className="ml-auto underline font-medium" onClick={handleAddForce}>Add anyway</button>
          </div>
        )}

        {/* ── Add section with tabs ── */}
        {!readOnly && (
          <div className="border-t border-gray-100 dark:border-gray-700">
            {/* Tab strip */}
            <div className="flex border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setAddTab('single')}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  addTab === 'single'
                    ? 'text-[#1e3a5f] dark:text-blue-300 border-b-2 border-[#1e3a5f] dark:border-blue-300 -mb-px bg-blue-50/50 dark:bg-blue-900/10'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                + This Day
              </button>
              <button
                onClick={() => setAddTab('range')}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  addTab === 'range'
                    ? 'text-[#1e3a5f] dark:text-blue-300 border-b-2 border-[#1e3a5f] dark:border-blue-300 -mb-px bg-blue-50/50 dark:bg-blue-900/10'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                📅 Date Range
              </button>
            </div>

            {/* ── Single event form ── */}
            {addTab === 'single' && (
              <div className="px-5 pt-3 pb-4 space-y-2">
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
                    type="text" value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="Event label..."
                    className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <input
                    type="time" value={newTime}
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

            {/* ── Date range form ── */}
            {addTab === 'range' && (
              <div className="px-5 pt-3 pb-4 space-y-3">
                {/* From / To pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">From</label>
                    <select
                      value={`${fromMonth.year}-${fromMonth.month}`}
                      onChange={e => {
                        const [y, m] = e.target.value.split('-')
                        setFromMonth(ACADEMIC_MONTHS.find(am => am.year === Number(y) && am.month === Number(m)) || ACADEMIC_MONTHS[0])
                      }}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {ACADEMIC_MONTHS.map(am => (
                        <option key={`${am.year}-${am.month}`} value={`${am.year}-${am.month}`}>
                          {MONTH_NAMES[am.month]} {am.year}
                        </option>
                      ))}
                    </select>
                    <select
                      value={fromDay}
                      onChange={e => setFromDay(Number(e.target.value))}
                      className="w-full mt-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {Array.from({ length: daysInFromMonth }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">To</label>
                    <select
                      value={`${toMonth.year}-${toMonth.month}`}
                      onChange={e => {
                        const [y, m] = e.target.value.split('-')
                        setToMonth(ACADEMIC_MONTHS.find(am => am.year === Number(y) && am.month === Number(m)) || ACADEMIC_MONTHS[0])
                      }}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {ACADEMIC_MONTHS.map(am => (
                        <option key={`${am.year}-${am.month}`} value={`${am.year}-${am.month}`}>
                          {MONTH_NAMES[am.month]} {am.year}
                        </option>
                      ))}
                    </select>
                    <select
                      value={toDay}
                      onChange={e => setToDay(Number(e.target.value))}
                      className="w-full mt-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {Array.from({ length: daysInToMonth }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <select
                  value={rangeCategory}
                  onChange={e => setRangeCategory(e.target.value)}
                  className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {categories.filter(c => c.visible).map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    type="text" value={rangeLabel}
                    onChange={e => setRangeLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRangeSubmit()}
                    placeholder="Event label..."
                    className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <input
                    type="time" value={rangeTime}
                    onChange={e => setRangeTime(e.target.value)}
                    className="w-28 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
                    title="Optional time"
                  />
                </div>

                {/* Range preview */}
                {toKey < fromKey && (
                  <p className="text-xs text-red-500">⚠️ End date must be after start date</p>
                )}
                {dateRange.length > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                    📅 Will add to <strong>{dateRange.length}</strong> day{dateRange.length !== 1 ? 's' : ''}
                    {dateRange.length <= 4 && (
                      <span className="ml-1 text-blue-500">
                        ({dateRange.map(dk => {
                          const d = new Date(dk + 'T00:00:00')
                          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        }).join(', ')})
                      </span>
                    )}
                  </p>
                )}

                {rangeSuccess && (
                  <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                    ✓ Added to {rangeSuccess} day{rangeSuccess !== 1 ? 's' : ''}
                  </p>
                )}

                <button
                  onClick={handleRangeSubmit}
                  disabled={!rangeLabel.trim() || dateRange.length === 0}
                  className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg font-semibold text-sm transition"
                >
                  Add to {dateRange.length || 0} Day{dateRange.length !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
