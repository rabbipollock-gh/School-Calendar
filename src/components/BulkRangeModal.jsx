import React, { useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { getDateRange } from '../utils/dateUtils.js'
import { nanoid } from '../utils/nanoid.js'
import { ACADEMIC_MONTHS } from '../hooks/useKeyboardNav.js'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function BulkRangeModal({ onClose }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { categories } = state

  const [fromMonth, setFromMonth] = useState(ACADEMIC_MONTHS[0])
  const [fromDay, setFromDay] = useState(1)
  const [toMonth, setToMonth] = useState(ACADEMIC_MONTHS[0])
  const [toDay, setToDay] = useState(1)
  const [category, setCategory] = useState(categories.find(c => c.visible)?.id || '')
  const [label, setLabel] = useState('')
  const [time, setTime] = useState('')

  const fromKey = `${fromMonth.year}-${String(fromMonth.month + 1).padStart(2, '0')}-${String(fromDay).padStart(2, '0')}`
  const toKey = `${toMonth.year}-${String(toMonth.month + 1).padStart(2, '0')}-${String(toDay).padStart(2, '0')}`

  let dateRange = []
  try {
    if (toKey >= fromKey) dateRange = getDateRange(fromKey, toKey)
  } catch {}

  const handleSubmit = () => {
    if (!label.trim() || dateRange.length === 0 || readOnly) return
    dispatch({
      type: 'ADD_RANGE',
      dateKeys: dateRange,
      event: { category, label: label.trim(), time: time || undefined },
    })
    onClose()
  }

  const MonthDayPicker = ({ label: fieldLabel, monthVal, onMonthChange, dayVal, onDayChange }) => {
    const daysInMonth = new Date(monthVal.year, monthVal.month + 1, 0).getDate()
    return (
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{fieldLabel}</label>
        <div className="flex gap-2">
          <select
            value={`${monthVal.year}-${monthVal.month}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-')
              onMonthChange(ACADEMIC_MONTHS.find(am => am.year === Number(y) && am.month === Number(m)) || ACADEMIC_MONTHS[0])
            }}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-400"
          >
            {ACADEMIC_MONTHS.map(am => (
              <option key={`${am.year}-${am.month}`} value={`${am.year}-${am.month}`}>
                {MONTH_NAMES[am.month]} {am.year}
              </option>
            ))}
          </select>
          <select
            value={dayVal}
            onChange={e => onDayChange(Number(e.target.value))}
            className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-400"
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#1e3a5f] flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Add Date Range</h2>
            <p className="text-white/60 text-xs">Apply an event across multiple days</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          <MonthDayPicker
            label="From"
            monthVal={fromMonth}
            onMonthChange={setFromMonth}
            dayVal={fromDay}
            onDayChange={setFromDay}
          />
          <MonthDayPicker
            label="To"
            monthVal={toMonth}
            onMonthChange={setToMonth}
            dayVal={toDay}
            onDayChange={setToDay}
          />

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-400"
            >
              {categories.filter(c => c.visible).map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Label</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Event name..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-28 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-400"
                title="Optional time"
              />
            </div>
          </div>

          {dateRange.length > 0 && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-800">
              📅 Will add to <strong>{dateRange.length} day{dateRange.length > 1 ? 's' : ''}</strong>
              {dateRange.length <= 5 && (
                <div className="text-xs text-blue-600 mt-0.5">
                  {dateRange.map(dk => {
                    const d = new Date(dk + 'T00:00:00')
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }).join(', ')}
                </div>
              )}
            </div>
          )}
          {toKey < fromKey && (
            <div className="bg-red-50 rounded-lg px-3 py-2 text-sm text-red-700">⚠️ End date must be after start date</div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={handleSubmit}
            disabled={!label.trim() || dateRange.length === 0}
            className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Add to {dateRange.length} Day{dateRange.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
