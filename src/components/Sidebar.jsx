import React, { useRef } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { parseCSV } from '../utils/importCSV.js'

function getInitials(name) {
  return (name || 'YA')
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Sidebar({ onOpenCategories, onOpenSettings, onOpenBulk }) {
  const { state, dispatch } = useCalendar()
  const { categories, schoolInfo, settings } = state
  const importRef = useRef(null)
  const [importToast, setImportToast] = React.useState(null)

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { events: items, errors } = parseCSV(ev.target.result, categories)
      if (items.length > 0) dispatch({ type: 'IMPORT_EVENTS', items })
      const msg = items.length > 0
        ? `Imported ${items.length} event${items.length > 1 ? 's' : ''}${errors.length > 0 ? ` (${errors.length} skipped)` : ''}`
        : `Nothing imported${errors.length > 0 ? ': ' + errors[0] : ''}`
      setImportToast(msg)
      setTimeout(() => setImportToast(null), 3500)
    }
    reader.readAsText(file)
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700 overflow-y-auto">

      {/* ── School branding header ── */}
      <div className="px-4 pt-5 pb-4 relative shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="absolute top-3 right-3 text-white/40 hover:text-white transition text-base leading-none"
            title="Edit school info"
          >✏️</button>
        )}

        {/* Logo or monogram */}
        <div className="flex justify-center mb-3">
          {schoolInfo.logo ? (
            <img
              src={schoolInfo.logo}
              alt="Logo"
              className="h-16 w-16 object-cover rounded-full border-2 border-white/30 shadow-lg"
            />
          ) : (
            <div className="h-16 w-16 rounded-full border-2 border-white/30 bg-white/10 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl tracking-wide select-none">
                {getInitials(schoolInfo.name)}
              </span>
            </div>
          )}
        </div>

        {/* School name */}
        <h2 className="text-white font-bold text-sm text-center leading-snug">
          {schoolInfo.name || 'School Name'}
        </h2>

        {/* Academic year in gold */}
        <p className="text-amber-300 text-[11px] text-center mt-1 font-medium tracking-wide">
          {settings.academicYear || '2026–2027'} · 5787
        </p>

        {/* Address + contact */}
        {schoolInfo.address && (
          <p className="text-white/45 text-[10px] text-center mt-2 leading-snug">
            {schoolInfo.address}
          </p>
        )}
        {(schoolInfo.phone || schoolInfo.fax) && (
          <p className="text-white/45 text-[10px] text-center mt-0.5 space-x-2">
            {schoolInfo.phone && <span>📞 {schoolInfo.phone}</span>}
            {schoolInfo.fax && <span>📠 {schoolInfo.fax}</span>}
          </p>
        )}
      </div>

      {/* ── School Hours ── */}
      {schoolInfo.hours && (
        <div className="mx-3 mt-3 shrink-0">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/50">
            <h3 className="text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <span>🕐</span> School Hours
            </h3>
            <pre className="text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
              {schoolInfo.hours}
            </pre>
          </div>
        </div>
      )}

      {/* ── Category Legend ── */}
      <div className="mx-3 mt-3 flex-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Legend
          </h3>
          <button
            onClick={onOpenCategories}
            className="text-[10px] text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition font-medium"
          >
            Edit
          </button>
        </div>
        <div className="space-y-1.5">
          {categories.filter(c => c.visible && c.id !== 'rosh-chodesh').map(cat => (
            <div key={cat.id} className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded shrink-0"
                style={{ background: cat.color }}
              />
              <span className="text-[11px] text-gray-700 dark:text-gray-300 leading-snug truncate">
                {cat.icon} {cat.name}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-gray-100 dark:border-gray-700">
            <span className="text-[11px] text-purple-400 shrink-0">🌙</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">Rosh Chodesh (badge)</span>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="mx-3 mt-3 shrink-0 space-y-1.5">
        <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
          Quick Actions
        </h3>

        <button
          onClick={onOpenBulk}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-200 text-xs font-medium transition"
          style={{ backgroundColor: 'var(--color-primary, #1e3a5f)' + '12', color: 'var(--color-primary)' }}
        >
          <span className="text-base">📅</span>
          <span>Add Date Range</span>
        </button>

        <input
          ref={importRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleImportFile}
        />
        <button
          onClick={() => importRef.current?.click()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-200 text-xs font-medium transition"
          style={{ backgroundColor: 'var(--color-primary, #1e3a5f)' + '12', color: 'var(--color-primary)' }}
        >
          <span className="text-base">📂</span>
          <span>Import CSV / Text</span>
        </button>

        <a
          href="/event-import-template.csv"
          download="yayoe-event-template.csv"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e3a5f]/8 hover:bg-[#1e3a5f]/15 dark:bg-white/5 dark:hover:bg-white/10 text-[#1e3a5f] dark:text-gray-200 text-xs font-medium transition"
        >
          <span className="text-base">⬇️</span>
          <span>Download CSV Template</span>
        </a>

        {importToast && (
          <div className="mt-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 text-xs">
            {importToast}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 mt-3 text-center shrink-0">
        <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-[10px] px-3 py-1 rounded-full">
          5787 · {settings.academicYear || '2026–2027'}
        </span>
      </div>
    </aside>
  )
}
