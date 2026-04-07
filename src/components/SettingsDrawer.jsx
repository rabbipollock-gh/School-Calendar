import React, { useRef, useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { THEME_MAP } from '../utils/themeUtils.js'
import { HEBREW_HOLIDAY_GROUPS } from '../data/hebrewCalendar.js'

// Group themes for display
const THEME_GROUPS = [
  { label: 'Classic', ids: ['navy-gold', 'blue-white', 'green-gold'] },
  { label: 'Bold', ids: ['crimson-gray', 'purple-silver'] },
  { label: 'Modern', ids: ['teal-gold', 'charcoal-orange', 'slate-rose'] },
  { label: 'Warm / Dark', ids: ['olive-cream', 'midnight-sky'] },
]

export default function SettingsDrawer({ isOpen, onClose, onOpenCategories, onOpenTemplates }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { schoolInfo, settings } = state
  const fileInputRef = useRef(null)
  const importRef = useRef(null)
  const [savedToast, setSavedToast] = useState(false)
  const savedTimerRef = useRef(null)

  const flashSaved = () => {
    setSavedToast(true)
    clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedToast(false), 2000)
  }

  const updateInfo = (field, val) => {
    if (readOnly) return
    dispatch({ type: 'UPDATE_SCHOOL_INFO', info: { [field]: val } })
    flashSaved()
  }
  const updateSettings = (key, val) => {
    if (readOnly) return
    dispatch({ type: 'UPDATE_SETTINGS', settings: { [key]: val } })
    flashSaved()
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
    if (!confirm('Advance to the next academic year and clear all events? School info and categories are kept.')) return
    const [start, end] = (state.settings.academicYear || '2026-2027').split('-').map(Number)
    const newYear = `${start + 1}-${end + 1}`
    dispatch({ type: 'LOAD_STATE', state: { ...state, events: {}, settings: { ...state.settings, academicYear: newYear } } })
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
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
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
              <Field label="Other Information">
                <textarea value={schoolInfo.otherInfo || ''} onChange={e => updateInfo('otherInfo', e.target.value)} readOnly={readOnly} rows={3} className={inputCls + ' resize-none'} placeholder="Any additional info to include on your calendar..." />
              </Field>
            </div>
          </section>

          {/* Logo */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">School Logo</h3>
            <div className="flex items-center gap-4">
              {schoolInfo.logo ? (
                <img src={schoolInfo.logo} alt="Logo" className="h-16 w-16 object-cover rounded-full border-2 border-gray-200 shadow-sm" />
              ) : (
                <div className="h-16 w-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-2xl">✡</div>
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

            {/* Logo shape */}
            {schoolInfo.logo && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Logo Shape in PDF</label>
                <div className="flex gap-2">
                  {[['circle', '⬤ Circle'], ['rounded', '▢ Rounded'], ['square', '■ Square']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => !readOnly && updateSettings('logoShape', val)}
                      className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-semibold transition ${
                        (settings.logoShape || 'circle') === val
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Calendar Settings */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Calendar Settings</h3>
            <div className="space-y-3">
              <Field label="Academic Year">
                <select
                  value={settings.academicYear}
                  onChange={e => updateSettings('academicYear', e.target.value)}
                  disabled={readOnly}
                  className={inputCls}
                >
                  {[2025,2026,2027,2028,2029,2030].map(y => (
                    <option key={y} value={`${y}-${y+1}`}>{y}–{y+1}</option>
                  ))}
                </select>
              </Field>
              <Field label="Hebrew Year (e.g. 5787)">
                <input type="text" value={settings.hebrewYear || ''} onChange={e => updateSettings('hebrewYear', e.target.value)} readOnly={readOnly} className={inputCls} placeholder="5787" />
              </Field>
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700 dark:text-gray-300">Show Hebrew Year in PDF</label>
                <button
                  onClick={() => updateSettings('showHebrewYear', !settings.showHebrewYear)}
                  className={`relative w-11 h-6 rounded-full transition ${settings.showHebrewYear !== false ? 'bg-[#2E86AB]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.showHebrewYear !== false ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <Field label="Custom Calendar Title (optional)">
                <input type="text" value={settings.calendarTitle || ''} onChange={e => updateSettings('calendarTitle', e.target.value)} readOnly={readOnly} className={inputCls} placeholder="Leave blank to use school name" />
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

              {/* Date Box Style */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Date Box Style</label>
                <div className="flex gap-2">
                  {['dots', 'filled'].map(style => (
                    <button
                      key={style}
                      onClick={() => updateSettings('cellStyle', style)}
                      className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-semibold capitalize transition ${
                        settings.cellStyle === style
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {style === 'dots' ? '● Dots' : '■ Filled'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Events Panel Position */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1.5">Events List Position</label>
                <div className="flex gap-2">
                  {[['inline', '↑ Inside Month'], ['bottom', '↓ Bottom of Page']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => updateSettings('eventsPanel', val)}
                      className={`flex-1 py-1.5 rounded-lg border-2 text-xs font-semibold transition ${
                        settings.eventsPanel === val
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Color Theme</h3>

            {THEME_GROUPS.map(group => (
              <div key={group.label} className="mb-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">{group.label}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {group.ids.map(id => {
                    const t = THEME_MAP[id]
                    const isActive = settings.theme === id
                    return (
                      <button
                        key={id}
                        onClick={() => updateSettings('theme', id)}
                        title={t.name}
                        className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition ${
                          isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex gap-0.5">
                          <div className="w-5 h-5 rounded-l-md" style={{ background: t.primary }} />
                          <div className="w-5 h-5 rounded-r-md border border-gray-200" style={{ background: t.accent }} />
                        </div>
                        <span className="text-[9px] font-medium text-gray-600 dark:text-gray-300 leading-tight text-center">{t.name}</span>
                        {isActive && (
                          <span className="absolute top-0.5 right-0.5 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-[7px] font-bold">✓</span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Custom theme */}
            <div className="mt-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Custom</p>
              <button
                onClick={() => updateSettings('theme', 'custom')}
                className={`w-full flex items-center gap-2 p-2.5 rounded-xl border-2 transition ${
                  settings.theme === 'custom' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="text-sm">🎨</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Custom Colors</span>
                {settings.theme === 'custom' && <span className="ml-auto text-blue-500 text-xs font-semibold">Active</span>}
              </button>
              {settings.theme === 'custom' && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Primary Color (header/months)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.customPrimary || '#1e3a5f'}
                        onChange={e => !readOnly && updateSettings('customPrimary', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={settings.customPrimary || '#1e3a5f'}
                        onChange={e => !readOnly && /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && updateSettings('customPrimary', e.target.value)}
                        className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        placeholder="#1e3a5f"
                      />
                    </div>
                    {/* Complementary color suggestions */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['#1e3a5f','#1a56db','#1a5e3a','#9B2335','#4B0082','#006d6d','#2C2C2C','#3d5a80','#4a5c2c','#0a0e2a'].map(c => (
                        <button key={c} onClick={() => !readOnly && updateSettings('customPrimary', c)}
                          className="w-6 h-6 rounded-md border-2 border-white shadow-sm hover:scale-110 transition"
                          style={{ background: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Accent Color (highlights)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.customAccent || '#D4AF37'}
                        onChange={e => !readOnly && updateSettings('customAccent', e.target.value)}
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                      />
                      <input
                        type="text"
                        value={settings.customAccent || '#D4AF37'}
                        onChange={e => !readOnly && /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && updateSettings('customAccent', e.target.value)}
                        className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        placeholder="#D4AF37"
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {['#D4AF37','#ffffff','#FF6B35','#E07A5F','#9DB5FF','#C0C0C0','#86efac','#fbbf24','#f472b6','#5eead4'].map(c => (
                        <button key={c} onClick={() => !readOnly && updateSettings('customAccent', c)}
                          className="w-6 h-6 rounded-md border-2 border-gray-200 shadow-sm hover:scale-110 transition"
                          style={{ background: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Jewish Holiday Badges */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Jewish Holiday Icons</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 leading-relaxed">
              Toggle holidays on/off. Click any icon to change it (type or paste any emoji).
              Names follow your Shabbat/Shabbos setting.
            </p>
            <div className="space-y-2">
              {HEBREW_HOLIDAY_GROUPS.map(group => {
                const enabled = (settings.hebrewHolidayToggles || {})[group.id] !== false
                const name = settings.shabbatLabel === 'Shabbos' ? group.ashkenaz : group.sephardi
                const customIcons = settings.hebrewHolidayIcons || {}
                const icon = customIcons[group.id] || group.icon
                return (
                  <div key={group.id} className="flex items-center gap-2">
                    {/* Clickable icon — tap to edit */}
                    <input
                      type="text"
                      value={icon}
                      onChange={e => {
                        const val = [...e.target.value].slice(-2).join('') || group.icon
                        updateSettings('hebrewHolidayIcons', { ...(settings.hebrewHolidayIcons || {}), [group.id]: val })
                      }}
                      className="w-8 h-8 text-center text-lg bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
                      title="Click to change icon"
                      maxLength={4}
                    />
                    <span className={`flex-1 text-sm ${enabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 line-through'}`}>
                      {name}
                    </span>
                    <button
                      onClick={() => {
                        const current = settings.hebrewHolidayToggles || {}
                        updateSettings('hebrewHolidayToggles', { ...current, [group.id]: !enabled })
                      }}
                      className={`relative w-11 h-6 shrink-0 rounded-full transition ${enabled ? 'bg-[#2E86AB]' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Quick links */}
          <section className="space-y-2">
            <button onClick={onOpenCategories} className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🎨 Manage Categories</span>
              <span className="text-gray-400">›</span>
            </button>
            <button onClick={onOpenTemplates} className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📄 Calendar View Style</span>
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
                📋 Start New Academic Year (clears events)
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

        {/* ── Saved toast footer ── */}
        <div
          className={`shrink-0 px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between transition-all duration-300 ${
            savedToast ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-900'
          }`}
        >
          <span className={`text-sm font-semibold transition-opacity duration-300 ${savedToast ? 'text-green-600 opacity-100' : 'opacity-0'}`}>
            ✓ Changes saved
          </span>
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Close
          </button>
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
