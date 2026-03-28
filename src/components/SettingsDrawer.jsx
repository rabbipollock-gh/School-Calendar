import React, { useRef } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'

const THEMES = [
  { id: 'navy-gold', name: 'Navy & Gold', primary: '#1e3a5f', accent: '#D4AF37' },
  { id: 'blue-white', name: 'Blue & White', primary: '#1a56db', accent: '#FFFFFF' },
  { id: 'green-gold', name: 'Green & Gold', primary: '#1a5e3a', accent: '#D4AF37' },
  { id: 'custom', name: 'Custom', primary: '#333333', accent: '#AAAAAA' },
]

export default function SettingsDrawer({ isOpen, onClose, onOpenCategories, onOpenTemplates }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { schoolInfo, settings } = state
  const fileInputRef = useRef(null)
  const importRef = useRef(null)

  const updateInfo = (field, val) => {
    if (readOnly) return
    dispatch({ type: 'UPDATE_SCHOOL_INFO', info: { [field]: val } })
  }
  const updateSettings = (key, val) => {
    if (readOnly) return
    dispatch({ type: 'UPDATE_SETTINGS', settings: { [key]: val } })
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => updateInfo('logo', ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        dispatch({ type: 'LOAD_STATE', state: imported })
        onClose()
      } catch {
        alert('Invalid backup file.')
      }
    }
    reader.readAsText(file)
  }

  const handleCloneLastYear = () => {
    if (!confirm('This will clear all events but keep your categories, school info, and settings.')) return
    dispatch({ type: 'UPDATE_SETTINGS', settings: {} })
    // Clear events only
    dispatch({ type: 'LOAD_STATE', state: { ...state, events: {} } })
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />}

      {/* Drawer */}
      <div
        id="settings-drawer"
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#1e3a5f] flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold text-lg">Settings</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* School Info */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">School Information</h3>
            <div className="space-y-3">
              <Field label="School Name">
                <input type="text" value={schoolInfo.name} onChange={e => updateInfo('name', e.target.value)} readOnly={readOnly} className={inputCls} />
              </Field>
              <Field label="Address">
                <input type="text" value={schoolInfo.address} onChange={e => updateInfo('address', e.target.value)} readOnly={readOnly} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Phone">
                  <input type="text" value={schoolInfo.phone} onChange={e => updateInfo('phone', e.target.value)} readOnly={readOnly} className={inputCls} />
                </Field>
                <Field label="Fax">
                  <input type="text" value={schoolInfo.fax} onChange={e => updateInfo('fax', e.target.value)} readOnly={readOnly} className={inputCls} />
                </Field>
              </div>
              <Field label="School Hours">
                <textarea value={schoolInfo.hours} onChange={e => updateInfo('hours', e.target.value)} readOnly={readOnly} rows={3} className={inputCls + ' resize-none'} />
              </Field>
            </div>
          </section>

          {/* Logo */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">School Logo</h3>
            <div className="flex items-center gap-4">
              {schoolInfo.logo ? (
                <img src={schoolInfo.logo} alt="Logo" className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50" />
              ) : (
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-2xl">✡</div>
              )}
              <div className="flex flex-col gap-2">
                {!readOnly && (
                  <button onClick={() => fileInputRef.current?.click()} className="text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-white px-3 py-1.5 rounded-lg transition">
                    Upload Logo
                  </button>
                )}
                {schoolInfo.logo && !readOnly && (
                  <button onClick={() => updateInfo('logo', null)} className="text-sm text-red-500 hover:text-red-700 transition">Remove</button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only" />
            </div>
          </section>

          {/* Calendar Settings */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Calendar Settings</h3>
            <div className="space-y-3">
              <Field label="Academic Year">
                <input type="text" value={settings.academicYear} onChange={e => updateSettings('academicYear', e.target.value)} readOnly={readOnly} className={inputCls} />
              </Field>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Shabbat Column Highlight</label>
                <button
                  onClick={() => updateSettings('shabbatHighlight', !settings.shabbatHighlight)}
                  className={`relative w-11 h-6 rounded-full transition ${settings.shabbatHighlight ? 'bg-[#2E86AB]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.shabbatHighlight ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">DRAFT Watermark on PDF</label>
                <button
                  onClick={() => updateSettings('draftWatermark', !settings.draftWatermark)}
                  className={`relative w-11 h-6 rounded-full transition ${settings.draftWatermark ? 'bg-red-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.draftWatermark ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Color Theme</h3>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => updateSettings('theme', theme.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition text-left ${settings.theme === theme.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                >
                  <div className="flex gap-1">
                    <div className="w-4 h-4 rounded" style={{ background: theme.primary }} />
                    <div className="w-4 h-4 rounded border border-gray-200" style={{ background: theme.accent }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{theme.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Quick links */}
          <section className="space-y-2">
            <button onClick={onOpenCategories} className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🎨 Manage Categories</span>
              <span className="text-gray-400">›</span>
            </button>
            <button onClick={onOpenTemplates} className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📄 Layout Templates</span>
              <span className="text-gray-400">›</span>
            </button>
          </section>

          {/* Backup */}
          <section className="pb-4">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Backup & Restore</h3>
            <div className="space-y-2">
              {!readOnly && (
                <button
                  onClick={() => importRef.current?.click()}
                  className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left text-gray-700 dark:text-gray-300"
                >
                  📂 Import Backup JSON
                </button>
              )}
              <button
                onClick={handleCloneLastYear}
                className="w-full text-sm border border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400 rounded-xl px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition text-left"
              >
                📋 Clone from Last Year (clear events)
              </button>
              {!readOnly && (
                <button
                  onClick={() => { if (confirm('Reset ALL data to factory defaults?')) dispatch({ type: 'RESET_ALL' }) }}
                  className="w-full text-sm border border-red-200 text-red-600 dark:border-red-800 dark:text-red-400 rounded-xl px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-left"
                >
                  🗑 Reset All Data
                </button>
              )}
            </div>
            <input ref={importRef} type="file" accept=".json" onChange={handleImportBackup} className="sr-only" />
          </section>
        </div>
      </div>
    </>
  )
}

const inputCls = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400 transition'

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}
