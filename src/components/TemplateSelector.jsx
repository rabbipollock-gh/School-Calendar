import React from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'

export default function TemplateSelector({ onClose }) {
  const { state, dispatch, readOnly } = useCalendar()
  const { settings } = state

  const TEMPLATES = [
    {
      id: 'classic',
      name: 'YAYOE Classic',
      description: '4-column grid, sidebar with hours/legend, bottom notes strip',
      preview: '📅',
    },
    {
      id: 'minimal',
      name: 'Modern Minimal',
      description: 'Cleaner layout, larger day cells, legend at top',
      preview: '🗓',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#1e3a5f] flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Layout Templates</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-5 space-y-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => !readOnly && dispatch({ type: 'UPDATE_SETTINGS', settings: { template: t.id } })}
              className={`w-full text-left p-4 rounded-xl border-2 transition ${
                settings.template === t.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{t.preview}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{t.name}</p>
                    {settings.template === t.id && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</p>
                </div>
              </div>
            </button>
          ))}

          <div className="mt-4 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">📎 Upload Reference PDF</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Upload a calendar you like for reference. The file is saved locally for Phase 2 template analysis.</p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) alert(`Reference PDF "${file.name}" noted! This will be used for custom template creation in Phase 2.`)
              }}
              className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
