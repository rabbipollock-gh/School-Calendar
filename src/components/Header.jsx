import React, { useState, useCallback } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { generateShareUrl, copyToClipboard } from '../utils/shareUrl.js'
import { exportPDF } from '../utils/exportPDF.js'
import { exportPPTX } from '../utils/exportPPTX.js'
import { exportICS } from '../utils/exportICS.js'
import { exportCSV } from '../utils/exportCSV.js'
import { triggerPrint } from '../utils/printStyles.js'

export default function Header({
  onOpenSettings,
  onOpenSearch,
  onOpenConflicts,
  onOpenHolidays,
  conflictCount = 0,
}) {
  const { state, dispatch, readOnly, isSharedView, canUndo, canRedo } = useCalendar()
  const { settings, schoolInfo, events, categories } = state

  const [exportOpen, setExportOpen] = useState(false)
  const [icsMenuOpen, setIcsMenuOpen] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleShabbatToggle = () => {
    if (readOnly) return
    dispatch({
      type: 'UPDATE_SETTINGS',
      settings: { shabbatLabel: settings.shabbatLabel === 'Shabbat' ? 'Shabbos' : 'Shabbat' },
    })
  }

  const handleLockToggle = () => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { locked: !settings.locked } })
  }

  const handleShare = async () => {
    const url = generateShareUrl({ events, categories, schoolInfo, settings })
    if (!url) return
    await copyToClipboard(url)
    setShareToast(true)
    setTimeout(() => setShareToast(false), 2500)
  }

  const handleExport = async (type, icsFilter) => {
    setExporting(true)
    setExportOpen(false)
    setIcsMenuOpen(false)
    try {
      if (type === 'pdf') await exportPDF(state)
      else if (type === 'pptx') await exportPPTX(state)
      else if (type === 'ics') await exportICS(events, categories, icsFilter || 'all', schoolInfo.name)
      else if (type === 'csv') exportCSV(events, categories, schoolInfo.name)
      else if (type === 'print') triggerPrint()
      else if (type === 'json') {
        const json = JSON.stringify({ events, categories, schoolInfo, settings }, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'yayoe-backup.json'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export error:', err)
      alert('Export failed: ' + err.message)
    }
    setExporting(false)
  }

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2 bg-[#1e3a5f] text-white shadow-xl"
    >
      {/* Logo + School Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {schoolInfo.logo ? (
          <img src={schoolInfo.logo} alt="Logo" className="h-10 w-10 rounded object-contain bg-white p-0.5 shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded bg-[#2E86AB] flex items-center justify-center text-white font-bold text-lg shrink-0">
            ✡
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-bold text-base leading-tight truncate">{schoolInfo.name || 'YAYOE Calendar Builder'}</h1>
          <p className="text-[#93c5fd] text-xs">Academic Year {settings.academicYear}</p>
        </div>
      </div>

      {/* Read-only / Shared banner */}
      {(isSharedView || settings.locked) && (
        <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs px-2.5 py-1 rounded-full">
          <span>{isSharedView ? '👁 Read-only view' : '🔒 Locked'}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Shabbat toggle */}
        <button
          onClick={handleShabbatToggle}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition px-3 py-1.5 rounded-full text-sm font-medium"
          title="Toggle Shabbat/Shabbos label"
        >
          🌙 <span className="hidden sm:inline">{settings.shabbatLabel}</span>
        </button>

        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition px-2.5 py-1.5 rounded-full text-sm"
          title="Search events (Cmd+K)"
        >
          🔍 <span className="hidden sm:inline text-xs opacity-80">⌘K</span>
        </button>

        {/* Holidays */}
        <button
          onClick={onOpenHolidays}
          className="hidden sm:flex items-center gap-1 bg-[#C3B1E1]/20 hover:bg-[#C3B1E1]/30 transition px-2.5 py-1.5 rounded-full text-sm"
          title="Holiday Suggestions"
        >
          ✡️
        </button>

        {/* Conflicts */}
        {conflictCount > 0 && (
          <button
            onClick={onOpenConflicts}
            className="relative flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 transition px-2.5 py-1.5 rounded-full text-sm"
            title={`${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`}
          >
            ⚠️
            <span className="absolute -top-1 -right-1 bg-amber-400 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {conflictCount}
            </span>
          </button>
        )}

        {/* Share */}
        <button
          onClick={handleShare}
          className="hidden sm:flex items-center gap-1 bg-white/10 hover:bg-white/20 transition px-2.5 py-1.5 rounded-full text-sm"
          title="Copy shareable link"
        >
          {shareToast ? '✓ Copied!' : '🔗'}
        </button>

        {/* Lock */}
        {!isSharedView && (
          <button
            onClick={handleLockToggle}
            className="flex items-center bg-white/10 hover:bg-white/20 transition px-2.5 py-1.5 rounded-full text-sm"
            title={settings.locked ? 'Unlock calendar' : 'Lock calendar'}
          >
            {settings.locked ? '🔒' : '🔓'}
          </button>
        )}

        {/* Undo/Redo */}
        {!readOnly && (
          <>
            <button
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={!canUndo}
              className="hidden sm:flex items-center bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition px-2 py-1.5 rounded-full text-sm"
              title="Undo (Cmd+Z)"
            >↩</button>
            <button
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={!canRedo}
              className="hidden sm:flex items-center bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition px-2 py-1.5 rounded-full text-sm"
              title="Redo"
            >↪</button>
          </>
        )}

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(o => !o)}
            className="flex items-center gap-1.5 bg-[#2E86AB] hover:bg-[#267a9c] transition px-3 py-1.5 rounded-full text-sm font-semibold"
            disabled={exporting}
          >
            {exporting ? '⏳' : '⬇️'} <span className="hidden sm:inline">Export</span>
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white text-gray-800 rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2">📄 Download PDF</button>
              <button onClick={() => handleExport('pptx')} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2">📊 Download PPTX</button>
              <div className="relative">
                <button
                  onClick={() => setIcsMenuOpen(o => !o)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2 justify-between"
                >
                  <span>📅 Export ICS</span> <span className="text-gray-400">▸</span>
                </button>
                {icsMenuOpen && (
                  <div className="absolute left-full top-0 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
                    <button onClick={() => handleExport('ics', 'all')} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm">All Events</button>
                    <button onClick={() => handleExport('ics', 'no-school')} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm">No School Days Only</button>
                  </div>
                )}
              </div>
              <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2">📋 Export CSV</button>
              <button onClick={() => handleExport('print')} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2">🖨️ Print / Save PDF</button>
              <div className="border-t border-gray-100">
                <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-500">💾 Export Backup JSON</button>
              </div>
              <div className="px-4 py-2.5 border-t border-gray-100">
                <button disabled className="w-full text-left text-xs text-gray-400 flex items-center gap-2">
                  🔗 Shareable Link <span className="ml-auto bg-gray-100 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">Phase 2</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex items-center bg-white/10 hover:bg-white/20 transition px-2.5 py-1.5 rounded-full text-sm"
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Close dropdowns on outside click */}
      {(exportOpen || icsMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setExportOpen(false); setIcsMenuOpen(false) }}
        />
      )}
    </header>
  )
}
