import React, { useState, useEffect } from 'react'
import { exportPDF } from '../utils/exportPDF.js'

export default function PDFPreviewModal({ state, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    exportPDF(state, { preview: true })
      .then(setUrl)
      .catch(err => setError(err.message || 'Failed to generate preview'))

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  const handleDownload = async () => {
    try {
      await exportPDF(state)
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#1e3a5f] text-white shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm tracking-wide">PDF Preview</span>
          <span className="text-white/40 text-xs">Review before downloading</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!url}
            className="flex items-center gap-1.5 bg-[#d4af37] hover:bg-[#c4a030] disabled:opacity-40 disabled:cursor-not-allowed text-[#1e3a5f] font-bold text-sm px-4 py-1.5 rounded-lg transition"
          >
            ↓ Download
          </button>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none ml-2 transition"
            title="Close preview"
          >×</button>
        </div>
      </div>

      {/* Preview area */}
      {error ? (
        <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      ) : !url ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 gap-3">
          <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Generating preview…</p>
        </div>
      ) : (
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          title="PDF Preview"
        />
      )}
    </div>
  )
}
