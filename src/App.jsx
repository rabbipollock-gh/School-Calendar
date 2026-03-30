import React, { useState, useCallback, useMemo } from 'react'
import { useCalendar } from './context/CalendarContext.jsx'
import SchoolCodeGate from './components/SchoolCodeGate.jsx'
import Header from './components/Header.jsx'
import CalendarGrid from './components/CalendarGrid.jsx'
import Sidebar from './components/Sidebar.jsx'
import EventModal from './components/EventModal.jsx'
import BulkRangeModal from './components/BulkRangeModal.jsx'
import SearchModal from './components/SearchModal.jsx'
import SettingsDrawer from './components/SettingsDrawer.jsx'
import CategoryManager from './components/CategoryManager.jsx'
import ConflictPanel from './components/ConflictPanel.jsx'
import HolidaySuggestionsPanel from './components/HolidaySuggestionsPanel.jsx'
import TemplateSelector from './components/TemplateSelector.jsx'
import PDFPreviewModal from './components/PDFPreviewModal.jsx'

export default function App() {
  const { state, isSharedView } = useCalendar()
  const { events } = state

  // Modal / panel state
  const [modalDate, setModalDate] = useState(null)      // EventModal date key
  const [bulkOpen, setBulkOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [highlightDate, setHighlightDate] = useState(null)

  // Keyboard shortcut: Cmd+K opens search
  React.useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setSearchOpen(s => !s) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleOpenModal = useCallback((dateKey) => {
    setModalDate(dateKey)
  }, [])

  const handleJumpToDate = useCallback((dateKey, openSearch = false) => {
    if (openSearch) { setSearchOpen(true); return }
    setSearchOpen(false)
    setHighlightDate(dateKey)
    setTimeout(() => setHighlightDate(null), 2000)
    // Also open the event modal after scroll
    if (dateKey) setTimeout(() => setModalDate(dateKey), 300)
  }, [])

  // Count conflicts (excluding acknowledged ones)
  const conflictCount = useMemo(() => {
    const acknowledged = new Set(state.settings.acknowledgedConflicts || [])
    return Object.entries(events).filter(([dateKey, evs]) => {
      if (!Array.isArray(evs)) return false
      if (acknowledged.has(dateKey)) return false
      const nonRC = evs.filter(e => e.category !== 'rosh-chodesh')
      return nonRC.length > 1
    }).length
  }, [events, state.settings.acknowledgedConflicts])

  return (
    <SchoolCodeGate>
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenConflicts={() => setConflictOpen(true)}
        onOpenHolidays={() => setHolidaysOpen(true)}
        onPreviewPDF={() => setPdfPreviewOpen(true)}
        conflictCount={conflictCount}
      />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar area */}
        <main className="flex-1 overflow-y-auto">
          <CalendarGrid
            onOpenModal={handleOpenModal}
            focusedDate={null}
            highlightDate={highlightDate}
          />

          {/* Mobile: Floating action button for bulk range + holidays */}
          <div className="md:hidden fixed bottom-20 right-4 flex flex-col gap-2 z-30">
            <button
              onClick={() => setHolidaysOpen(true)}
              className="w-12 h-12 rounded-full bg-[#6b4fa8] text-white shadow-lg flex items-center justify-center text-lg hover:scale-105 transition"
              title="Holiday Suggestions"
            >✡️</button>
            <button
              onClick={() => setBulkOpen(true)}
              className="w-12 h-12 rounded-full bg-[#1e3a5f] text-white shadow-lg flex items-center justify-center text-xl font-bold hover:scale-105 transition"
              title="Add Date Range"
            >+</button>
          </div>

          {/* Mobile bottom tab bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex z-30 safe-area-pb">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-[#1e3a5f] transition"
            >
              <span className="text-lg">🔍</span>
              <span className="text-[9px]">Search</span>
            </button>
            <button
              onClick={() => setHolidaysOpen(true)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-[#6b4fa8] transition"
            >
              <span className="text-lg">✡️</span>
              <span className="text-[9px]">Holidays</span>
            </button>
            <button
              onClick={() => setBulkOpen(true)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-[#1e3a5f] transition"
            >
              <span className="text-lg">📅</span>
              <span className="text-[9px]">Bulk Add</span>
            </button>
            <button
              onClick={() => setCategoriesOpen(true)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-[#1e3a5f] transition"
            >
              <span className="text-lg">🎨</span>
              <span className="text-[9px]">Categories</span>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex-1 py-3 flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-[#1e3a5f] transition"
            >
              <span className="text-lg">⚙️</span>
              <span className="text-[9px]">Settings</span>
            </button>
          </div>
        </main>

        {/* Sidebar */}
        <Sidebar
          onOpenCategories={() => setCategoriesOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenBulk={() => setBulkOpen(true)}
        />
      </div>

      {/* ── Modals & Panels ── */}

      {modalDate && (
        <EventModal
          dateKey={modalDate}
          onClose={() => setModalDate(null)}
        />
      )}

      {bulkOpen && (
        <BulkRangeModal onClose={() => setBulkOpen(false)} />
      )}

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onJumpToDate={handleJumpToDate}
      />

      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenCategories={() => { setSettingsOpen(false); setCategoriesOpen(true) }}
        onOpenTemplates={() => { setSettingsOpen(false); setTemplatesOpen(true) }}
      />

      {categoriesOpen && (
        <CategoryManager onClose={() => setCategoriesOpen(false)} />
      )}

      <ConflictPanel
        isOpen={conflictOpen}
        onClose={() => setConflictOpen(false)}
        onJumpToDate={handleJumpToDate}
      />

      <HolidaySuggestionsPanel
        isOpen={holidaysOpen}
        onClose={() => setHolidaysOpen(false)}
        onOpenModal={handleOpenModal}
      />

      {templatesOpen && (
        <TemplateSelector onClose={() => setTemplatesOpen(false)} />
      )}

      {pdfPreviewOpen && (
        <PDFPreviewModal
          state={state}
          onClose={() => setPdfPreviewOpen(false)}
        />
      )}

      {/* Shared view banner (mobile) */}
      {isSharedView && (
        <div className="md:hidden fixed top-16 left-0 right-0 bg-amber-500 text-white text-xs text-center py-1.5 z-30">
          👁 Read-only shared view
        </div>
      )}
    </div>
    </SchoolCodeGate>
  )
}
