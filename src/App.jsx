import React, { useState, useCallback, useMemo } from 'react'
import { useCalendar } from './context/CalendarContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import AuthGate from './components/AuthGate.jsx'
import OnboardingWizard from './components/OnboardingWizard.jsx'
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
import CollabModal from './components/CollabModal.jsx'
import DiagnosticsModal from './components/DiagnosticsModal.jsx'
import CalendarManagerModal from './components/CalendarManagerModal.jsx'
import YayoePasswordGate, { isYayoeUnlocked } from './components/YayoePasswordGate.jsx'

// Initialize error log interception as early as possible
import './utils/errorLog.js'

export default function App() {
  const { session, loading: authLoading, isNewUser } = useAuth()
  const { state, isSharedView, cloudToast, acceptCloudVersion, dismissCloudToast } = useCalendar()

  // All hooks must come before any conditional returns (Rules of Hooks)
  const [yayoeUnlocked, setYayoeUnlocked] = useState(isYayoeUnlocked)
  const [modalDate, setModalDate] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [collabOpen, setCollabOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [calendarManagerOpen, setCalendarManagerOpen] = useState(false)
  const [onboardingPreviewOpen, setOnboardingPreviewOpen] = useState(false)
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
    if (dateKey) setTimeout(() => setModalDate(dateKey), 300)
  }, [])

  // Count conflicts (excluding acknowledged ones)
  const conflictCount = useMemo(() => {
    const evts = state.events || {}
    const acknowledged = new Set(state.settings?.acknowledgedConflicts || [])
    return Object.entries(evts).filter(([dateKey, evs]) => {
      if (!Array.isArray(evs)) return false
      if (acknowledged.has(dateKey)) return false
      const nonRC = evs.filter(e => e.category !== 'rosh-chodesh')
      return nonRC.length > 1
    }).length
  }, [state.events, state.settings?.acknowledgedConflicts])

  const hash = window.location.hash.slice(1)
  const isYayoe = hash === 'yayoe' || hash.startsWith('yayoe-')
  const isSharedUrl = new URLSearchParams(window.location.search).has('cal')
  const needsAuth = !isYayoe && !isSharedUrl && !session

  if (authLoading) return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (needsAuth) return <AuthGate />
  if (isYayoe && !session && !yayoeUnlocked) return <YayoePasswordGate onUnlock={() => setYayoeUnlocked(true)} />
  if (isNewUser) return <OnboardingWizard />
  const { events } = state

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
        onOpenCollab={() => setCollabOpen(true)}
        onOpenCalendarManager={() => setCalendarManagerOpen(true)}
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
        onOpenDiagnostics={() => { setSettingsOpen(false); setDiagnosticsOpen(true) }}
        onPreviewOnboarding={() => { setSettingsOpen(false); setOnboardingPreviewOpen(true) }}
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
          onClose={() => setPdfPreviewOpen(false)}
        />
      )}

      {collabOpen && (
        <CollabModal onClose={() => setCollabOpen(false)} />
      )}

      {diagnosticsOpen && (
        <DiagnosticsModal onClose={() => setDiagnosticsOpen(false)} />
      )}

      {calendarManagerOpen && (
        <CalendarManagerModal onClose={() => setCalendarManagerOpen(false)} />
      )}

      {onboardingPreviewOpen && (
        <OnboardingWizard preview onClose={() => setOnboardingPreviewOpen(false)} />
      )}

      {/* Shared view banner (mobile) */}
      {isSharedView && (
        <div className="md:hidden fixed top-16 left-0 right-0 bg-amber-500 text-white text-xs text-center py-1.5 z-30">
          👁 Read-only shared view
        </div>
      )}

      {/* ── Cloud sync banners ── */}
      {cloudToast === 'synced' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 pointer-events-none">
          <span>☁️</span> Synced from cloud
        </div>
      )}
      {cloudToast === 'newer' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 max-w-sm w-[calc(100%-2rem)]">
          <span className="text-2xl shrink-0">☁️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Cloud version available</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A newer version of your calendar is saved in the cloud. Load it now?</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={acceptCloudVersion}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
            >
              Load
            </button>
            <button
              onClick={dismissCloudToast}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-lg transition"
            >
              Keep local
            </button>
          </div>
        </div>
      )}
    </div>
    </SchoolCodeGate>
  )
}
