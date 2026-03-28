import React, { useState, useEffect, useRef } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { buildSearchIndex, searchEvents } from '../utils/searchIndex.js'
import { parseDateKey } from '../utils/dateUtils.js'

export default function SearchModal({ isOpen, onClose, onJumpToDate }) {
  const { state } = useCalendar()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const index = buildSearchIndex(state.events, state.categories)
    setResults(searchEvents(query, index))
    setSelectedIdx(0)
  }, [query, state.events, state.categories])

  // Cmd+K global shortcut
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else onJumpToDate && onJumpToDate(null, true) // open signal
      }
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) {
      onJumpToDate?.(results[selectedIdx].dateKey)
      onClose()
    }
    if (e.key === 'Escape') onClose()
  }

  const handleSelect = (result) => {
    onJumpToDate?.(result.dateKey)
    onClose()
  }

  const formatDate = (dateKey) => {
    const d = parseDateKey(dateKey)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden mx-4">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search events, dates, categories..."
            className="flex-1 bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none text-base"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.length > 0 && results.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">No events found for "{query}"</div>
          )}
          {results.length === 0 && query.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              <p className="text-2xl mb-2">📅</p>
              Type to search across all {Object.values(state.events).flat().length} events
            </div>
          )}
          {results.map((result, idx) => (
            <button
              key={`${result.dateKey}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition ${
                idx === selectedIdx ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: result.categoryColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{result.labelDisplay}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(result.dateKey)} · {result.categoryName}</p>
              </div>
              {idx === selectedIdx && <kbd className="text-xs text-gray-400">↵</kbd>}
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 flex gap-4">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>
  )
}
