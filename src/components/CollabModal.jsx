import React, { useState } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { generateShareUrl, copyToClipboard } from '../utils/shareUrl.js'
import { getSchoolCode } from '../utils/schoolCode.js'

export default function CollabModal({ onClose }) {
  const { state, dispatch, isSharedView, collabUnlocked, setCollabUnlocked } = useCalendar()
  const { settings, events, categories, schoolInfo } = state

  const hasPassword = !!(settings.collabPassword)
  const [newPassword, setNewPassword] = useState('')
  const [enteredPassword, setEnteredPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSetPassword = () => {
    const pw = newPassword.trim()
    if (!pw) return
    dispatch({ type: 'UPDATE_SETTINGS', settings: { collabPassword: pw } })
    setNewPassword('')
    showToast('Collaboration password saved.')
  }

  const handleRemovePassword = () => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { collabPassword: '' } })
    showToast('Password removed.')
  }

  const handleCopyLink = async () => {
    const url = generateShareUrl({ events, categories, schoolInfo, settings })
    if (!url) return
    await copyToClipboard(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleUnlock = () => {
    if (enteredPassword === settings.collabPassword) {
      setCollabUnlocked(true)
      setError('')
      showToast('Editing unlocked!')
      setTimeout(onClose, 900)
    } else {
      setError('Incorrect password. Please try again.')
    }
  }

  // Adopt: write shared state into localStorage under the current URL hash and strip ?cal=
  const handleAdopt = () => {
    const code = getSchoolCode()
    if (!code) {
      alert(
        'To adopt this calendar, add your school code to the URL first.\n\n' +
        'Example: go to  yoursite.com/#my-school  then open this link again.'
      )
      return
    }
    const storageKey = `yayoe-calendar-v1-${code}`
    const { undoPast, undoFuture, ...toSave } = state
    localStorage.setItem(storageKey, JSON.stringify(toSave))
    // Strip ?cal= from URL and reload so the app reads from localStorage
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <div>
            <h2 className="text-white font-bold text-base">🤝 Collaboration</h2>
            <p className="text-white/60 text-xs mt-0.5">
              {isSharedView ? 'Shared view — enter password to edit' : 'Share this calendar with your team'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Collaborator: unlock editing ── */}
          {isSharedView && !collabUnlocked && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You're viewing a <span className="font-semibold text-amber-600">read-only</span> shared
                calendar.{hasPassword ? ' Enter the password to enable editing.' : ''}
              </p>

              {hasPassword ? (
                <>
                  <input
                    type="password"
                    value={enteredPassword}
                    onChange={e => { setEnteredPassword(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                    placeholder="Collaboration password"
                    autoFocus
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <button
                    onClick={handleUnlock}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    Unlock Editing
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  No collaboration password was set by the calendar admin.
                </p>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Want to own and edit this calendar permanently?
                </p>
                <button
                  onClick={handleAdopt}
                  className="text-xs font-semibold underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Adopt &amp; save to my browser →
                </button>
              </div>
            </div>
          )}

          {/* ── Already unlocked ── */}
          {isSharedView && collabUnlocked && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm text-green-700 dark:text-green-300">
              ✅ Editing is unlocked for this session. To save permanently, use <strong>Adopt</strong> below.
              <div className="mt-2">
                <button
                  onClick={handleAdopt}
                  className="text-xs font-semibold underline text-green-700 dark:text-green-400"
                >
                  Adopt &amp; save to my browser →
                </button>
              </div>
            </div>
          )}

          {/* ── Admin: manage password & share ── */}
          {!isSharedView && (
            <>
              {/* Password section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Collaboration Password</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    hasPassword
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>
                    {hasPassword ? 'Set' : 'Not set'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Collaborators will need this password to edit the calendar from your share link.
                </p>

                {hasPassword && (
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-2.5">
                    <span className="text-sm text-gray-400 tracking-[0.25em]">{'•'.repeat(Math.min(settings.collabPassword.length, 12))}</span>
                    <button
                      onClick={handleRemovePassword}
                      className="ml-auto text-xs text-red-400 hover:text-red-600 font-medium transition"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                    placeholder={hasPassword ? 'Change password…' : 'Set a password…'}
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    onClick={handleSetPassword}
                    disabled={!newPassword.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {hasPassword ? 'Change' : 'Set'}
                  </button>
                </div>
              </div>

              {/* Share link section */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Share Link</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Copies a link with your full calendar embedded. Collaborators open it and enter the password to edit.
                  To sync changes back, they send you their updated link.
                </p>
                {!hasPassword && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                    ⚠ No password set — link will be view-only for others.
                  </p>
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition"
                  style={{
                    borderColor: 'var(--color-primary)',
                    color: 'var(--color-primary)',
                    backgroundColor: copied ? 'rgba(30,58,95,0.06)' : 'white',
                  }}
                >
                  {copied ? '✓ Link Copied!' : '🔗 Copy Share Link'}
                </button>
              </div>

              {/* How it works */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">How collaboration works</p>
                <ol className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Set a collaboration password above</li>
                  <li>Copy the share link and send it + the password to your team</li>
                  <li>They open the link, enter the password, and can edit</li>
                  <li>To merge edits back, they copy their updated link and send it to you</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-gray-900 text-white text-xs px-4 py-2 rounded-xl shadow-xl">
              {toast}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
