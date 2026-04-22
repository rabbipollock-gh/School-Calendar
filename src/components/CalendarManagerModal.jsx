import React, { useState, useEffect } from 'react'
import { useCalendar } from '../context/CalendarContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getSchoolCode } from '../utils/schoolCode.js'
import {
  getCalendarIndex,
  getTrashIndex,
  getStorageKeyForId,
  createCalendar,
  duplicateCalendar,
  archiveCalendar,
  unarchiveCalendar,
  softDeleteCalendar,
  restoreCalendar,
  permanentlyDeleteCalendar,
} from '../utils/calendarManager.js'
import {
  saveToCloud,
  updateCalendarStatus,
  permanentlyDeleteFromCloud,
} from '../lib/supabaseSync.js'

function daysAgo(iso) {
  if (!iso) return ''
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

export default function CalendarManagerModal({ onClose }) {
  const { state } = useCalendar()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const currentId = getSchoolCode() || 'default'

  const [active, setActive] = useState([])
  const [archived, setArchived] = useState([])
  const [trash, setTrash] = useState([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const [trashExpanded, setTrashExpanded] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [duplicateName, setDuplicateName] = useState('')
  const [confirmPermDeleteId, setConfirmPermDeleteId] = useState(null)

  function refreshAll() {
    const idx = getCalendarIndex()
    const tr = getTrashIndex()
    if (idx.length === 0) {
      // Synthetic entry for users who haven't saved yet
      const synth = [{
        id: currentId,
        name: state.schoolInfo?.name || 'My Calendar',
        academicYear: state.settings?.academicYear || '',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
      setActive(synth)
      setArchived([])
    } else {
      setActive(idx.filter(e => !e.archived))
      setArchived(idx.filter(e => e.archived))
    }
    setTrash(tr)
  }

  useEffect(() => { refreshAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function clearError() { setError('') }

  async function handleCreate() {
    clearError()
    if (!newName.trim()) return
    try {
      const id = createCalendar(newName)
      if (userId) await saveToCloud(userId, id, {})
      window.location.hash = id
      window.location.reload()
    } catch (e) {
      setError(e.message)
    }
  }

  function handleSwitch(id) {
    if (id === currentId) return
    window.location.hash = id
    window.location.reload()
  }

  async function handleDuplicateConfirm(sourceId) {
    clearError()
    try {
      const sourceRaw = localStorage.getItem(getStorageKeyForId(sourceId))
      const sourceState = sourceRaw ? JSON.parse(sourceRaw) : null
      const newId = duplicateCalendar(sourceId, duplicateName, sourceState)
      if (userId && sourceState) {
        const copy = JSON.parse(JSON.stringify(sourceState))
        copy.schoolInfo = { ...copy.schoolInfo, name: duplicateName.trim() }
        delete copy.undoPast; delete copy.undoFuture
        await saveToCloud(userId, newId, copy)
      }
      window.location.hash = newId
      window.location.reload()
    } catch (e) {
      setError(e.message)
      setDuplicatingId(null)
    }
  }

  async function handleArchive(id) {
    clearError()
    try {
      archiveCalendar(id)
      if (userId) await updateCalendarStatus(userId, id, 'archived')
      refreshAll()
    } catch (e) { setError(e.message) }
  }

  async function handleUnarchive(id) {
    clearError()
    try {
      unarchiveCalendar(id)
      if (userId) await updateCalendarStatus(userId, id, 'active')
      refreshAll()
    } catch (e) { setError(e.message) }
  }

  async function handleSoftDelete(id) {
    clearError()
    try {
      const idx = getCalendarIndex()
      const isActive = idx.find(e => e.id === id && !e.archived)
      const next = isActive
        ? (idx.find(e => e.id !== id && !e.archived) ?? idx.find(e => e.id !== id))
        : null
      softDeleteCalendar(id)
      if (userId) await updateCalendarStatus(userId, id, 'deleted', new Date().toISOString())
      if (isActive && next) {
        window.location.hash = next.id
        window.location.reload()
      } else {
        refreshAll()
      }
    } catch (e) { setError(e.message) }
  }

  async function handleRestore(id) {
    clearError()
    try {
      restoreCalendar(id)
      if (userId) await updateCalendarStatus(userId, id, 'active', null)
      refreshAll()
    } catch (e) { setError(e.message) }
  }

  async function handlePermDelete(id) {
    clearError()
    try {
      permanentlyDeleteCalendar(id)
      if (userId) await permanentlyDeleteFromCloud(userId, id)
      setConfirmPermDeleteId(null)
      refreshAll()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
          <h2 className="text-white font-bold text-lg">My Calendars</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Active calendars */}
          <div className="p-4 space-y-2">
            {active.length === 0 && (
              <p className="text-sm text-gray-400 italic text-center py-4">No active calendars</p>
            )}
            {active.map(entry => (
              <CalendarRow
                key={entry.id}
                entry={entry}
                isCurrent={entry.id === currentId}
                onSwitch={() => handleSwitch(entry.id)}
                onArchive={() => handleArchive(entry.id)}
                onDelete={() => handleSoftDelete(entry.id)}
                duplicatingId={duplicatingId}
                duplicateName={duplicateName}
                onStartDuplicate={() => { setDuplicatingId(entry.id); setDuplicateName(entry.name + ' (copy)'); clearError() }}
                onDuplicateNameChange={setDuplicateName}
                onDuplicateConfirm={() => handleDuplicateConfirm(entry.id)}
                onDuplicateCancel={() => setDuplicatingId(null)}
              />
            ))}
          </div>

          {/* Archived section */}
          {archived.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setArchivedExpanded(v => !v)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <span>Archived ({archived.length})</span>
                <span className="text-xs">{archivedExpanded ? '▲' : '▼'}</span>
              </button>
              {archivedExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {archived.map(entry => (
                    <ArchivedRow
                      key={entry.id}
                      entry={entry}
                      isCurrent={entry.id === currentId}
                      onSwitch={() => handleSwitch(entry.id)}
                      onUnarchive={() => handleUnarchive(entry.id)}
                      onDelete={() => handleSoftDelete(entry.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trash section */}
          {trash.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setTrashExpanded(v => !v)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <span>Recently Deleted ({trash.length})</span>
                <span className="text-xs">{trashExpanded ? '▲' : '▼'}</span>
              </button>
              {trashExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {trash.map(entry => (
                    <TrashRow
                      key={entry.id}
                      entry={entry}
                      onRestore={() => handleRestore(entry.id)}
                      confirmPermDeleteId={confirmPermDeleteId}
                      onStartPermDelete={() => { setConfirmPermDeleteId(entry.id); clearError() }}
                      onPermDelete={() => handlePermDelete(entry.id)}
                      onCancelPermDelete={() => setConfirmPermDeleteId(null)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error bar */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800 shrink-0">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Create new */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Create New Calendar</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); clearError() }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Calendar name..."
              className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CalendarRow({ entry, isCurrent, onSwitch, onArchive, onDelete, duplicatingId, duplicateName, onStartDuplicate, onDuplicateNameChange, onDuplicateConfirm, onDuplicateCancel }) {
  const isDuplicating = duplicatingId === entry.id
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{entry.name}</p>
        {entry.academicYear && <p className="text-xs text-gray-400">{entry.academicYear}</p>}
      </div>
      {isCurrent && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium shrink-0">
          Active
        </span>
      )}
      {isDuplicating ? (
        <div className="flex items-center gap-2 shrink-0">
          <input
            autoFocus
            value={duplicateName}
            onChange={e => onDuplicateNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onDuplicateConfirm(); if (e.key === 'Escape') onDuplicateCancel() }}
            placeholder="New calendar name..."
            className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-400 w-36"
          />
          <button onClick={onDuplicateConfirm} className="text-xs text-blue-600 font-semibold hover:text-blue-800">Copy</button>
          <button onClick={onDuplicateCancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          {!isCurrent && (
            <button
              onClick={onSwitch}
              className="text-xs px-2 py-1 rounded-lg text-white transition"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Switch
            </button>
          )}
          <button
            onClick={onArchive}
            title="Archive"
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Archive
          </button>
          <button
            onClick={onStartDuplicate}
            title="Duplicate"
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Copy
          </button>
          <button
            onClick={onDelete}
            title="Move to Trash"
            className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  )
}

function ArchivedRow({ entry, isCurrent, onSwitch, onUnarchive, onDelete }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate">{entry.name}</p>
        {entry.academicYear && <p className="text-xs text-gray-400">{entry.academicYear}</p>}
      </div>
      {isCurrent && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium shrink-0">
          Active
        </span>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {!isCurrent && (
          <button onClick={onSwitch} className="text-xs px-2 py-1 rounded-lg text-white transition" style={{ backgroundColor: 'var(--color-primary)' }}>
            Switch
          </button>
        )}
        <button onClick={onUnarchive} className="text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition">
          Unarchive
        </button>
        <button onClick={onDelete} title="Move to Trash" className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
          🗑
        </button>
      </div>
    </div>
  )
}

function TrashRow({ entry, onRestore, confirmPermDeleteId, onStartPermDelete, onPermDelete, onCancelPermDelete }) {
  const isConfirming = confirmPermDeleteId === entry.id
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate line-through">{entry.name}</p>
        <p className="text-xs text-gray-400">Deleted {daysAgo(entry.deletedAt)}</p>
      </div>
      {isConfirming ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-red-600 dark:text-red-400">Delete forever?</span>
          <button onClick={onPermDelete} className="text-xs font-semibold text-red-600 hover:text-red-800">Yes</button>
          <button onClick={onCancelPermDelete} className="text-xs text-gray-400 hover:text-gray-600">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onRestore} className="text-xs px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 transition">
            Restore
          </button>
          <button onClick={onStartPermDelete} className="text-xs px-2 py-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
            Delete Forever
          </button>
        </div>
      )}
    </div>
  )
}
