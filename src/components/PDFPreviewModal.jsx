import React, { useState, useEffect, useRef } from 'react'
import { exportPDF } from '../utils/exportPDF.js'
import { useCalendar } from '../context/CalendarContext.jsx'

const PDF_STYLES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Landscape A4 · 4 months across · sidebar with hours & legend',
    icon: '📅',
    tag: 'Most Popular',
    tagColor: 'bg-blue-100 text-blue-700',
    previewBg: 'from-[#1e3a5f] to-[#2a4d7a]',
  },
  {
    id: 'minimal',
    name: 'Clean Minimal',
    description: 'Landscape · no sidebar · white background · hairline grid',
    icon: '◻',
    tag: 'Modern',
    tagColor: 'bg-gray-100 text-gray-600',
    previewBg: 'from-gray-100 to-white',
  },
  {
    id: 'portrait-monthly',
    name: 'Monthly Portrait',
    description: 'One month per page · portrait A4/letter · large grid',
    icon: '📄',
    tag: 'Family-Friendly',
    tagColor: 'bg-green-100 text-green-700',
    previewBg: 'from-green-50 to-white',
  },
  {
    id: 'year-at-a-glance',
    name: 'Year at a Glance',
    description: 'All months tiny on one page · great for fridge or binder',
    icon: '🗓',
    tag: 'Overview',
    tagColor: 'bg-amber-100 text-amber-700',
    previewBg: 'from-amber-50 to-white',
  },
  {
    id: 'dark-elegant',
    name: 'Dark Elegant',
    description: 'Dark navy/charcoal background · light text · premium feel',
    icon: '🌙',
    tag: 'Premium',
    tagColor: 'bg-purple-100 text-purple-700',
    previewBg: 'from-gray-900 to-gray-700',
  },
  {
    id: 'bulletin-board',
    name: 'Bulletin Board',
    description: 'Bold color-blocked month headers · chunky layout · vibrant',
    icon: '📌',
    tag: 'Colorful',
    tagColor: 'bg-orange-100 text-orange-700',
    previewBg: 'from-orange-400 to-pink-400',
  },
]

export default function PDFPreviewModal({ onClose }) {
  const { state } = useCalendar()
  // Keep a ref so async PDF callbacks always see the latest state
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const [selectedStyle, setSelectedStyle] = useState('classic')
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  // Auto-generate preview for classic on mount
  useEffect(() => {
    handlePreview('classic')
  }, [])

  const handlePreview = async (styleId) => {
    const id = styleId || selectedStyle
    setSelectedStyle(id)
    setUrl(null)
    setError(null)
    setPreviewing(true)
    try {
      const blobUrl = await exportPDF(stateRef.current, { preview: true, pdfStyle: id })
      setUrl(blobUrl)
    } catch (err) {
      setError(err.message || 'Failed to generate preview')
    }
    setPreviewing(false)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await exportPDF(stateRef.current, { preview: false, pdfStyle: selectedStyle })
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
    setDownloading(false)
  }

  const activeStyle = PDF_STYLES.find(s => s.id === selectedStyle)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900">

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 text-white shrink-0 shadow-lg"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm tracking-wide">📄 PDF Export</span>
          <span className="text-white/40 text-xs hidden sm:inline">Choose a style, then download</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 font-bold text-sm px-4 py-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-on-accent, #1e3a5f)' }}
          >
            {downloading ? '⏳ Saving…' : '↓ Download'}
          </button>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none ml-2 transition"
          >×</button>
        </div>
      </div>

      {/* Main area: style picker left + preview right */}
      <div className="flex flex-1 overflow-hidden">

        {/* Style Picker */}
        <div className="w-72 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 pb-1">PDF Style</p>
          {PDF_STYLES.map(style => (
            <button
              key={style.id}
              onClick={() => handlePreview(style.id)}
              className={`w-full text-left rounded-xl border-2 overflow-hidden transition ${
                selectedStyle === style.id
                  ? 'border-blue-500 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Mini color preview band */}
              <div className={`h-8 bg-gradient-to-r ${style.previewBg} flex items-center justify-center`}>
                <span className="text-xl">{style.icon}</span>
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{style.name}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${style.tagColor}`}>
                    {style.tag}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{style.description}</p>
                {selectedStyle === style.id && (
                  <div className="mt-1.5 flex items-center gap-1 text-blue-500 text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Selected
                  </div>
                )}
              </div>
            </button>
          ))}

          <div className="pt-2 pb-1 px-1">
            <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-relaxed">
              All styles use your current theme colors and school info. Switch themes in ⚙️ Settings.
            </p>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Preview header */}
          <div className="shrink-0 px-4 py-2 bg-gray-100 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Preview: {activeStyle?.name}
            </span>
            <button
              onClick={() => handlePreview(selectedStyle)}
              disabled={previewing}
              className="ml-auto text-xs text-blue-500 hover:text-blue-700 font-semibold disabled:opacity-40 transition"
            >
              {previewing ? '⏳ Generating…' : '🔄 Refresh Preview'}
            </button>
          </div>

          {error ? (
            <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
              <div className="text-center">
                <p className="text-red-500 text-sm font-medium mb-2">⚠ Preview Error</p>
                <p className="text-gray-400 text-xs max-w-xs">{error}</p>
                <button onClick={() => handlePreview(selectedStyle)} className="mt-3 text-xs text-blue-500 underline">
                  Try again
                </button>
              </div>
            </div>
          ) : previewing || !url ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 gap-4">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
              />
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Generating preview…</p>
                <p className="text-gray-400 text-xs mt-1">Building {activeStyle?.name} style</p>
              </div>
            </div>
          ) : (
            <iframe
              src={url}
              className="flex-1 w-full border-0"
              title="PDF Preview"
            />
          )}
        </div>
      </div>
    </div>
  )
}
