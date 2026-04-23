import React, { useState, useEffect } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getLog, clearLog, getLastCloudSave } from '../utils/errorLog.js'
import { getSessionMetrics } from '../utils/sessionMetrics.js'
import { APP_VERSION } from '../version.js'

const LEVEL_COLORS = {
  error: 'text-red-400',
  warn:  'text-amber-400',
  info:  'text-blue-400',
}

function getBrowserShort() {
  const ua = navigator.userAgent
  if (ua.includes('Firefox/')) return `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ''}`
  if (ua.includes('Edg/'))     return `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] ?? ''}`
  if (ua.includes('Chrome/'))  return `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ''}`
  if (ua.includes('Safari/') && ua.includes('Version/')) return `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ''}`
  return ua.slice(0, 60)
}

function formatTs(iso) {
  if (!iso) return '—'
  return iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
}

function timeSince(iso) {
  if (!iso) return '—'
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export default function DiagnosticsModal({ onClose }) {
  const { state } = useCalendar()
  const { session } = useAuth()
  const [entries, setEntries] = useState([])
  const [metrics, setMetrics] = useState(getSessionMetrics())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setEntries(getLog())
    setMetrics(getSessionMetrics())
    const id = setInterval(() => {
      setEntries(getLog())
      setMetrics(getSessionMetrics())
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const schoolCode = window.location.hash.slice(1) || '(none)'
  const userId = session?.user?.id ?? '(not logged in)'
  const academicYear = state.settings?.academicYear ?? '(unknown)'
  const lastSave = getLastCloudSave() ?? '(no save this session)'

  const totalEvents = Object.values(state.events ?? {}).reduce((n, arr) => n + arr.length, 0)
  const totalCategories = (state.categories ?? []).length
  const noSchoolDays = Object.entries(state.events ?? {}).reduce((n, [, arr]) => {
    return n + (arr.some(e => e.category === 'no-school') ? 1 : 0)
  }, 0)

  const summaryText = [
    `App version:     v${APP_VERSION}`,
    `User ID:         ${userId}`,
    `School code:     ${schoolCode}`,
    `Academic year:   ${academicYear}`,
    `Last cloud save: ${lastSave}`,
    '',
    `Total events:    ${totalEvents}`,
    `Categories:      ${totalCategories}`,
    `No-school days:  ${noSchoolDays}`,
    `Browser:         ${getBrowserShort()}`,
    `Screen:          ${window.screen.width}×${window.screen.height}`,
    '',
    `Session start:   ${formatTs(metrics.sessionStart)}`,
    `Dispatches:      ${metrics.dispatchCount}`,
    `Last change:     ${timeSince(metrics.lastDispatchAt)}`,
    '',
    'Export history:',
    ...(metrics.exportHistory.length === 0
      ? ['  (none this session)']
      : metrics.exportHistory.map(e => `  [${formatTs(e.ts)}] ${e.format} · ${e.label}`)),
    '',
    'Log entries:',
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
      <div className="bg-gray-900 text-gray-100 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold">Diagnostics</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-700/50">
          {/* System info */}
          <div className="px-5 py-3 text-xs font-mono text-gray-300 space-y-1">
            <div className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide mb-2">System</div>
            <div><span className="text-gray-500">App version:</span> v{APP_VERSION}</div>
            <div><span className="text-gray-500">User ID:</span> {userId}</div>
            <div><span className="text-gray-500">School code:</span> {schoolCode}</div>
            <div><span className="text-gray-500">Academic year:</span> {academicYear}</div>
            <div><span className="text-gray-500">Last cloud save:</span> {lastSave}</div>
            <div><span className="text-gray-500">Browser:</span> {getBrowserShort()}</div>
            <div><span className="text-gray-500">Screen:</span> {window.screen.width}×{window.screen.height}</div>
          </div>

          {/* Calendar stats */}
          <div className="px-5 py-3 text-xs font-mono text-gray-300 space-y-1">
            <div className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide mb-2">Calendar</div>
            <div><span className="text-gray-500">Total events:</span> {totalEvents}</div>
            <div><span className="text-gray-500">Categories:</span> {totalCategories}</div>
            <div><span className="text-gray-500">No-school days:</span> {noSchoolDays}</div>
          </div>

          {/* Session metrics */}
          <div className="px-5 py-3 text-xs font-mono text-gray-300 space-y-1">
            <div className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide mb-2">Session</div>
            <div><span className="text-gray-500">Started:</span> {formatTs(metrics.sessionStart)}</div>
            <div><span className="text-gray-500">Dispatches:</span> {metrics.dispatchCount}</div>
            <div><span className="text-gray-500">Last change:</span> {timeSince(metrics.lastDispatchAt)}</div>
          </div>

          {/* Export history */}
          <div className="px-5 py-3 text-xs font-mono text-gray-300 space-y-1">
            <div className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide mb-2">Export History</div>
            {metrics.exportHistory.length === 0 ? (
              <p className="text-gray-600 italic">No exports this session.</p>
            ) : (
              metrics.exportHistory.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-600 shrink-0">{formatTs(e.ts)}</span>
                  <span className="text-amber-400 shrink-0">{e.format}</span>
                  <span className="text-gray-300">{e.label}</span>
                </div>
              ))
            )}
          </div>

          {/* Log entries */}
          <div className="px-5 py-3 text-xs font-mono text-gray-300 space-y-1">
            <div className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide mb-2">Log</div>
            {entries.length === 0 ? (
              <p className="text-gray-600 italic">No log entries captured yet.</p>
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
          <span className="ml-auto text-gray-600 text-xs">{entries.length} log entries</span>
        </div>
      </div>
    </div>
  )
}
