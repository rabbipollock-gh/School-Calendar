import React, { useState } from 'react'

const STORAGE_KEY = 'yayoe-unlocked'
const CORRECT = 'Y@yoe123!'

export function isYayoeUnlocked() {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export default function YayoePasswordGate({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pw === CORRECT) {
      localStorage.setItem(STORAGE_KEY, '1')
      onUnlock()
    } else {
      setError('Incorrect password.')
      setPw('')
    }
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#1e3a5f] px-6 py-5 text-center">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">✡</span>
          </div>
          <h1 className="text-white font-bold text-xl">YAYOE Calendar Builder</h1>
          <p className="text-white/60 text-sm mt-1">Academic Calendar for Jewish Schools</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError('') }}
              placeholder="Enter password"
              required
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
            />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={!pw}
            className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7a] disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm transition"
          >
            Unlock Calendar →
          </button>
        </form>
      </div>
    </div>
  )
}
