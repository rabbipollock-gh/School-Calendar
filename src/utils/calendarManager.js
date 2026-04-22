import { slugify } from './schoolCode.js'

const INDEX_KEY = 'yayoe-calendar-index-v1'
const TRASH_KEY = 'yayoe-calendar-trash-v1'

// ── Internal helpers ─────────────────────────────────────────────────────────

function _getIndex(key) {
  try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] }
}

function _setIndex(key, entries) {
  localStorage.setItem(key, JSON.stringify(entries))
}

// ── Public index reads ───────────────────────────────────────────────────────

export function getCalendarIndex() {
  return _getIndex(INDEX_KEY)
}

export function getTrashIndex() {
  return _getIndex(TRASH_KEY)
}

export function getStorageKeyForId(id) {
  return `yayoe-calendar-v1-${id}`
}

// ── Upsert active index entry ────────────────────────────────────────────────

export function upsertCalendarEntry(id, { name, academicYear }) {
  const index = _getIndex(INDEX_KEY)
  const now = new Date().toISOString()
  const existing = index.find(e => e.id === id)
  if (existing) {
    existing.name = name
    existing.academicYear = academicYear
    existing.updatedAt = now
  } else {
    index.push({ id, name, academicYear, archived: false, createdAt: now, updatedAt: now })
  }
  _setIndex(INDEX_KEY, index)
}

// ── One-time migration for existing users ────────────────────────────────────

export function adoptExistingCalendarIfNeeded(currentId, currentState) {
  const index = _getIndex(INDEX_KEY)
  if (index.some(e => e.id === currentId)) return
  upsertCalendarEntry(currentId, {
    name: currentState?.schoolInfo?.name || 'My Calendar',
    academicYear: currentState?.settings?.academicYear || '',
  })
}

// ── Create a new calendar (slug + collision guard) ───────────────────────────

export function createCalendar(name) {
  const base = slugify(name.trim())
  if (!base) throw new Error('Invalid calendar name')
  const index = _getIndex(INDEX_KEY)
  const trash = _getIndex(TRASH_KEY)
  const allIds = new Set([...index.map(e => e.id), ...trash.map(e => e.id)])
  let id = base
  let counter = 2
  while (allIds.has(id)) id = `${base}-${counter++}`
  upsertCalendarEntry(id, { name: name.trim(), academicYear: '' })
  return id
}

// ── Duplicate a calendar ─────────────────────────────────────────────────────

export function duplicateCalendar(sourceId, newName, sourceState) {
  if (!sourceState) throw new Error('Source calendar not found')
  const newId = createCalendar(newName)
  const copy = JSON.parse(JSON.stringify(sourceState))
  copy.schoolInfo = { ...copy.schoolInfo, name: newName.trim() }
  delete copy.undoPast
  delete copy.undoFuture
  const key = getStorageKeyForId(newId)
  try {
    localStorage.setItem(key, JSON.stringify(copy))
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      copy.schoolInfo = { ...copy.schoolInfo, logo: null, bannerImage: null }
      try { localStorage.setItem(key, JSON.stringify(copy)) } catch {}
    }
  }
  upsertCalendarEntry(newId, {
    name: newName.trim(),
    academicYear: sourceState?.settings?.academicYear || '',
  })
  return newId
}

// ── Archive / unarchive ──────────────────────────────────────────────────────

export function archiveCalendar(id) {
  const index = _getIndex(INDEX_KEY)
  const entry = index.find(e => e.id === id)
  if (entry) { entry.archived = true; entry.updatedAt = new Date().toISOString() }
  _setIndex(INDEX_KEY, index)
}

export function unarchiveCalendar(id) {
  const index = _getIndex(INDEX_KEY)
  const entry = index.find(e => e.id === id)
  if (entry) { entry.archived = false; entry.updatedAt = new Date().toISOString() }
  _setIndex(INDEX_KEY, index)
}

// ── Soft delete (move to trash, data preserved) ──────────────────────────────

export function softDeleteCalendar(id) {
  const index = _getIndex(INDEX_KEY)
  const activeCount = index.filter(e => !e.archived).length
  if (activeCount <= 1 && index.find(e => e.id === id && !e.archived)) {
    throw new Error('Cannot delete the only active calendar')
  }
  const entry = index.find(e => e.id === id)
  if (!entry) return
  const newIndex = index.filter(e => e.id !== id)
  _setIndex(INDEX_KEY, newIndex)
  const trash = _getIndex(TRASH_KEY)
  if (!trash.some(e => e.id === id)) {
    trash.push({ id, name: entry.name, academicYear: entry.academicYear, deletedAt: new Date().toISOString() })
    _setIndex(TRASH_KEY, trash)
  }
}

// ── Restore from trash ───────────────────────────────────────────────────────

export function restoreCalendar(id) {
  const trash = _getIndex(TRASH_KEY)
  const entry = trash.find(e => e.id === id)
  if (!entry) return
  _setIndex(TRASH_KEY, trash.filter(e => e.id !== id))
  upsertCalendarEntry(id, { name: entry.name, academicYear: entry.academicYear })
}

// ── Permanently delete (removes data too) ───────────────────────────────────

export function permanentlyDeleteCalendar(id) {
  const trash = _getIndex(TRASH_KEY)
  _setIndex(TRASH_KEY, trash.filter(e => e.id !== id))
  localStorage.removeItem(getStorageKeyForId(id))
}

// ── Seed local index from cloud entries (called on login) ────────────────────

export function seedIndexFromCloud(cloudEntries) {
  // cloudEntries = [{ slug, name, academic_year, status, updated_at, deleted_at }]
  const activeIndex = _getIndex(INDEX_KEY)
  const trashIndex = _getIndex(TRASH_KEY)
  const activeIds = new Set(activeIndex.map(e => e.id))
  const trashIds = new Set(trashIndex.map(e => e.id))

  for (const entry of cloudEntries) {
    const id = entry.slug
    const name = entry.name || 'My Calendar'
    const academicYear = entry.academic_year || ''

    if (entry.status === 'deleted') {
      if (!trashIds.has(id)) {
        trashIndex.push({ id, name, academicYear, deletedAt: entry.deleted_at || new Date().toISOString() })
        trashIds.add(id)
      }
    } else {
      if (!activeIds.has(id)) {
        const now = new Date().toISOString()
        activeIndex.push({
          id, name, academicYear,
          archived: entry.status === 'archived',
          createdAt: now,
          updatedAt: entry.updated_at || now,
        })
        activeIds.add(id)
      }
    }
  }

  _setIndex(INDEX_KEY, activeIndex)
  _setIndex(TRASH_KEY, trashIndex)
}
