import React, { useState, useEffect } from 'react'
import { getSchoolCode, slugify } from '../utils/schoolCode.js'

export default function SchoolCodeGate({ children }) {
  const [hasCode] = useState(() => !!getSchoolCode())
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  // Also allow arriving via a ?cal= share link (read-only shared view — no code needed)
  const isSharedUrl = new URLSearchParams(window.location.search).has('cal')

  // If there's a hash code in the URL, render the calendar directly
  if (hasCode || isSharedUrl) return children

  const handleStart = () => {
    const slug = slugify(name)
    if (!slug) { setError('Please enter a school name.'); return }
    // Force a full reload so the storage key re-evaluates with the new hash
    window.location.href = window.location.pathname + '#' + slug
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e3a5f] px-6 py-5 text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">✡</span>
          </div>
          <h1 className="text-white font-bold text-xl">YAYOE Calendar Builder</h1>
          <p className="text-white/60 text-sm mt-1">Academic Calendar for Jewish Schools</p>
        </div>

        {/* Form */}
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Your School Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="e.g. Hillel Academy"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
              autoFocus
            />
            {name && (
              <p className="text-xs text-gray-400 mt-1">
                Your calendar URL: <span className="font-mono text-[#1e3a5f]">#{slugify(name)}</span>
              </p>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          <button
            onClick={handleStart}
            disabled={!name.trim()}
            className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Start My Calendar →
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Your calendar is saved privately in this browser.<br />
            Return anytime by visiting the same URL with your school's code.
          </p>
        </div>
      </div>
    </div>
  )
}
