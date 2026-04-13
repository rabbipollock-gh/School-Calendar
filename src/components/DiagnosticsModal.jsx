import React, { useState, useEffect } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getLog, clearLog, getLastCloudSave } from '../utils/errorLog.js'
import { APP_VERSION } from '../version.js'

const LEVEL_COLORS = {
  error: 'text-red-400',
  warn:  'text-amber-400',
  info:  'text-blue-400',
}

export default function DiagnosticsModal({ onClose }) {
  const { state } = useCalendar()
  const { session } = useAuth()
  const [entries, setEntries] = useState([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setEntries(getLog())
    const id = setInterval(() => setEntries(getLog()), 2000)
    return () => clearInterval(id)
  }, [])

  const schoolCode = window.location.hash.slice(1) || '(none)'
  const userId = session?.user?.id ?? '(not logged in)'
  const academicYear = state.settings?.academicYear ?? '(unknown)'
  const lastSave = getLastCloudSave() ?? '(no save this session)'

  const summaryText = [
    `App version:   v${APP_VERSION}`,
    `User ID:       ${userId}`,
    `School code:   ${schoolCode}`,
    `Academic year: ${academicYear}`,
    `Last cloud save: ${lastSave}`,
    '',
    ...entries.map(e => `[${e.ts}] ${e.level.toUpperCase()} — ${e.msg}`),
  ].join('\n')

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleClear = () => {
    clearLog()
    setEntries([])
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-gray-900 text-gray-100 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold">Diagnostics</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>

        {/* System info */}
        <div className="px-5 py-3 border-b border-gray-700 text-xs space-y-1 font-mono text-gray-300">
          <div><span className="text-gray-500">App version:</span> v{APP_VERSION}</div>
          <div><span className="text-gray-500">User ID:</span> {userId}</div>
          <div><span className="text-gray-500">School code:</span> {schoolCode}</div>
          <div><span className="text-gray-500">Academic year:</span> {academicYear}</div>
          <div><span className="text-gray-500">Last cloud save:</span> {lastSave}</div>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto px-5 py-3 font-mono text-xs space-y-1">
          {entries.length === 0 ? (
            <p className="text-gray-500 italic">No log entries captured yet.</p>
          ) : (
            [...entries].reverse().map((e, i) => (
              <div key={i} className="flex gap-2 leading-relaxed">
                <span className="text-gray-600 shrink-0">{e.ts.replace('T', ' ').replace('Z', '')}</span>
                <span className={`${LEVEL_COLORS[e.level] ?? 'text-gray-400'} shrink-0 uppercase text-[10px] mt-px`}>{e.level}</span>
                <span className="text-gray-300 break-all">{e.msg}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-700 flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
          >
            {copied ? '✓ Copied' : 'Copy all'}
          </button>
          <button
            onClick={handleClear}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
          >
            Clear log
          </button>
          <span className="ml-auto text-gray-600 text-xs">{entries.length} entries (last 50)</span>
        </div>
      </div>
    </div>
  )
}
