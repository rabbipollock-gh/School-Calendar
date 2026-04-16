import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { getAcademicMonths } from '../utils/academicMonths.js'
import { DEFAULT_CATEGORIES } from '../data/defaultCategories.js'
import { DEFAULT_EVENTS, YAYOE_EVENTS } from '../data/defaultEvents.js'
import { nanoid } from '../utils/nanoid.js'
import { getSharedState } from '../utils/shareUrl.js'
import { getSchoolCode } from '../utils/schoolCode.js'
import { getTheme, applyThemeToCss } from '../utils/themeUtils.js'
import { loadFromCloud, saveToCloud, debounce } from '../lib/supabaseSync.js'
import { useAuth } from './AuthContext.jsx'
import { logger } from '../utils/logger.js'

function getStorageKey() {
  return `yayoe-calendar-v1-${getSchoolCode() || 'default'}`
}

// ── Default school info ───────────────────────────────────────────────────
const DEFAULT_SCHOOL_INFO = {
  name: 'Yeshiva Aharon Yaakov Ohr Eliyahu',
  address: '241 S. Detroit St., Los Angeles, CA 90036',
  phone: '323-556-6900',
  fax: '323-556-6901',
  email: '',
  website: 'www.yayoe.org',
  logo: null,
  bannerImage: null,
  hours: 'Boys: 8:30 AM – 4:00 PM\nGirls: 8:30 AM – 3:30 PM\nFriday: 8:30 AM – 1:30 PM',
  otherInfo: '',
}

const DEFAULT_SETTINGS = {
  shabbatLabel: 'Shabbat',
  shabbatHighlight: true,
  theme: 'navy-gold',
  customPrimary: null,
  customAccent: null,
  academicYear: '2026-2027',
  hebrewYear: '5787',
  calendarTitle: '',        // custom title override (empty = use school name)
  showHebrewYear: true,     // show Hebrew year in PDF headers
  hebrewHolidayToggles: {}, // { groupId: false } to disable; absent = enabled
  hebrewHolidayIcons: {},   // { groupId: '🎯' } to override default icon
  locked: false,
  draftWatermark: false,
  monthNotes: {},
  template: 'classic',
  cellStyle: 'dots',        // 'dots' | 'filled'
  eventsPanel: 'inline',    // 'inline' | 'bottom'
  logoShape: 'circle',      // 'circle' | 'rounded' | 'square'
  sidebarBlocks: [
    { id: 'hours',     label: 'School Hours',      visible: true },
    { id: 'legend',    label: 'Event Legend',       visible: true },
    { id: 'otherInfo', label: 'Other Information',  visible: true },
    { id: 'contact',   label: 'Contact Info',       visible: true },
  ],
  firstDayOfSchool: '',  // YYYY-MM-DD
  lastDayOfSchool:  '',  // YYYY-MM-DD
}

// ── ID normalizer for default events ────────────────────────────────────
function normalizeEvents(rawEvents) {
  const normalized = {}
  Object.entries(rawEvents).forEach(([dateKey, evs]) => {
    normalized[dateKey] = evs.map(ev => ({
      ...ev,
      id: ev.id && !ev.id.startsWith('ev-undefined') ? ev.id : 'ev-' + nanoid(),
    }))
  })
  return normalized
}

// ── Build initial state ───────────────────────────────────────────────────
function buildInitialState() {
  // YAYOE gets its pre-loaded events; every other school starts blank
  const isYayoe = (getSchoolCode() || '').toLowerCase().includes('yayoe')
  const sourceEvents = isYayoe ? YAYOE_EVENTS : DEFAULT_EVENTS
  const events = normalizeEvents(sourceEvents)
  const schoolInfo = isYayoe ? DEFAULT_SCHOOL_INFO : {
    name: '', address: '', phone: '', fax: '', email: '', website: '', logo: null, bannerImage: null, hours: '', otherInfo: '',
  }
  return {
    events,
    categories: DEFAULT_CATEGORIES,
    schoolInfo,
    settings: DEFAULT_SETTINGS,
    hebrewEventToggles: {},
    undoPast: [],
    undoFuture: [],
  }
}

// ── Load from localStorage ───────────────────────────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(getStorageKey())
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

// Strip legacy Rosh Chodesh events and remap old early-dismissal category ids
const EARLY_LEGACY_IDS = new Set(['early-130', 'early-1200', 'early-1130'])
const EARLY_DISMISSAL_DEFAULT = { id: 'early-dismissal', name: 'Early Dismissal', color: '#D68910', icon: '🕐', visible: true, deletable: true }

// Migrate old pastel category colors to new saturated versions
const CATEGORY_COLOR_UPGRADES = {
  'no-school':       { from: '#F4A261', to: '#C0392B' },
  'early-dismissal': { from: '#A8E6CF', to: '#D68910' },
  'staff':           { from: '#FFD3A5', to: '#7D3C98' },
  'school-event':    { from: '#A8D8EA', to: '#1A7ABF' },
  'chanukah':        { from: '#FFF0A0', to: '#C7960A' },
  'hebrew-only':     { from: '#D4EAFF', to: '#148F77' },
}

function migrateState(state) {
  if (!state?.events) return state
  const cleanEvents = {}
  Object.entries(state.events).forEach(([dk, evs]) => {
    const filtered = (evs || [])
      .filter(e => e.category !== 'rosh-chodesh')
      .map(e => EARLY_LEGACY_IDS.has(e.category) ? { ...e, category: 'early-dismissal' } : e)
    if (filtered.length > 0) cleanEvents[dk] = filtered
  })
  const result = { ...state, events: cleanEvents }
  if (Array.isArray(state.categories)) {
    const filtered = state.categories.filter(c => !EARLY_LEGACY_IDS.has(c.id))
    // Inject early-dismissal after no-school if it was removed by migration
    if (!filtered.some(c => c.id === 'early-dismissal')) {
      const noSchoolIdx = filtered.findIndex(c => c.id === 'no-school')
      filtered.splice(noSchoolIdx >= 0 ? noSchoolIdx + 1 : 1, 0, EARLY_DISMISSAL_DEFAULT)
    }
    // Upgrade old pastel colors to new saturated versions
    result.categories = filtered.map(cat => {
      const upgrade = CATEGORY_COLOR_UPGRADES[cat.id]
      if (upgrade && cat.color?.toLowerCase() === upgrade.from.toLowerCase()) {
        return { ...cat, color: upgrade.to }
      }
      return cat
    })
  }
  return result
}

function saveToStorage(state) {
  const { undoPast, undoFuture, ...toSave } = state
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(toSave))
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      // Storage full — likely due to large logo. Save without logo as fallback.
      try {
        const withoutLogo = { ...toSave, schoolInfo: { ...toSave.schoolInfo, logo: null, bannerImage: null } }
        localStorage.setItem(getStorageKey(), JSON.stringify(withoutLogo))
        console.warn('[Storage] localStorage quota exceeded — logo/banner stripped from local save. Cloud sync will preserve them.')
      } catch {}
    }
  }
}

// ── Reducer ───────────────────────────────────────────────────────────────
const MAX_UNDO = 20

function snapshot(state) {
  return { events: state.events, categories: state.categories, settings: state.settings, schoolInfo: state.schoolInfo }
}

function pushUndo(state) {
  return {
    undoPast: [...state.undoPast.slice(-MAX_UNDO + 1), snapshot(state)],
    undoFuture: [],
  }
}

function reducer(state, action) {
  if (action.type === 'UNDO') {
    if (state.undoPast.length === 0) return state
    const prev = state.undoPast[state.undoPast.length - 1]
    return {
      ...state,
      ...prev,
      undoPast: state.undoPast.slice(0, -1),
      undoFuture: [snapshot(state), ...state.undoFuture],
    }
  }
  if (action.type === 'REDO') {
    if (state.undoFuture.length === 0) return state
    const next = state.undoFuture[0]
    return {
      ...state,
      ...next,
      undoPast: [...state.undoPast, snapshot(state)],
      undoFuture: state.undoFuture.slice(1),
    }
  }

  switch (action.type) {
    case 'ADD_EVENT': {
      const { dateKey, event } = action
      const existing = state.events[dateKey] || []
      return {
        ...state,
        ...pushUndo(state),
        events: {
          ...state.events,
          [dateKey]: [...existing, { ...event, id: event.id || 'ev-' + nanoid() }],
        },
      }
    }

    case 'EDIT_EVENT': {
      const { dateKey, eventId, changes } = action
      return {
        ...state,
        ...pushUndo(state),
        events: {
          ...state.events,
          [dateKey]: (state.events[dateKey] || []).map(e =>
            e.id === eventId ? { ...e, ...changes } : e
          ),
        },
      }
    }

    case 'DELETE_EVENT': {
      const { dateKey, eventId } = action
      const filtered = (state.events[dateKey] || []).filter(e => e.id !== eventId)
      const newEvents = { ...state.events }
      if (filtered.length === 0) delete newEvents[dateKey]
      else newEvents[dateKey] = filtered
      return { ...state, ...pushUndo(state), events: newEvents }
    }

    case 'ADD_RANGE': {
      const { dateKeys, event } = action
      const newEvents = { ...state.events }
      dateKeys.forEach(dk => {
        newEvents[dk] = [...(newEvents[dk] || []), { ...event, id: 'ev-' + nanoid() }]
      })
      return { ...state, ...pushUndo(state), events: newEvents }
    }

    case 'IMPORT_EVENTS': {
      // action.items = [{ dateKey, event }]
      const newEvents = { ...state.events }
      action.items.forEach(({ dateKey, event }) => {
        newEvents[dateKey] = [...(newEvents[dateKey] || []), { ...event, id: event.id || 'ev-' + nanoid() }]
      })
      return { ...state, ...pushUndo(state), events: newEvents }
    }

    case 'RESET_MONTH': {
      const { year, month } = action
      const newEvents = { ...state.events }
      // Remove all events for this month
      Object.keys(newEvents).forEach(dk => {
        const d = new Date(dk + 'T00:00:00')
        if (d.getFullYear() === year && d.getMonth() === month) {
          delete newEvents[dk]
        }
      })
      // Re-add defaults for this month
      const defaults = normalizeEvents(DEFAULT_EVENTS)
      Object.entries(defaults).forEach(([dk, evs]) => {
        const d = new Date(dk + 'T00:00:00')
        if (d.getFullYear() === year && d.getMonth() === month) {
          newEvents[dk] = evs
        }
      })
      return { ...state, ...pushUndo(state), events: newEvents }
    }

    case 'ADD_CATEGORY': {
      const cat = { ...action.category, id: action.category.id || 'cat-' + nanoid(), deletable: true }
      return { ...state, categories: [...state.categories, cat] }
    }

    case 'EDIT_CATEGORY': {
      return {
        ...state,
        categories: state.categories.map(c =>
          c.id === action.categoryId ? { ...c, ...action.changes } : c
        ),
      }
    }

    case 'DELETE_CATEGORY': {
      const cat = state.categories.find(c => c.id === action.categoryId)
      if (!cat || !cat.deletable) return state
      return {
        ...state,
        categories: state.categories.filter(c => c.id !== action.categoryId),
      }
    }

    case 'UPDATE_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.settings } }
    }

    case 'ACKNOWLEDGE_CONFLICT': {
      const existing = state.settings.acknowledgedConflicts || []
      if (existing.includes(action.dateKey)) return state
      return {
        ...state,
        settings: { ...state.settings, acknowledgedConflicts: [...existing, action.dateKey] },
      }
    }

    case 'SET_MONTH_NOTE': {
      return {
        ...state,
        settings: {
          ...state.settings,
          monthNotes: { ...state.settings.monthNotes, [action.monthKey]: action.note },
        },
      }
    }

    case 'UPDATE_SCHOOL_INFO': {
      return { ...state, schoolInfo: { ...state.schoolInfo, ...action.info } }
    }

    case 'TOGGLE_HEBREW_EVENT': {
      const { eventId, enabled } = action
      return {
        ...state,
        hebrewEventToggles: { ...state.hebrewEventToggles, [eventId]: enabled },
      }
    }

    case 'REORDER_CATEGORIES': {
      const { fromIndex, toIndex } = action
      const cats = [...state.categories]
      const [moved] = cats.splice(fromIndex, 1)
      cats.splice(toIndex, 0, moved)
      return { ...state, categories: cats }
    }

    case 'LOAD_STATE': {
      return { ...state, ...action.state, undoPast: [], undoFuture: [] }
    }

    case 'RESET_ALL': {
      return { ...buildInitialState() }
    }

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────
const CalendarContext = createContext(null)

export function CalendarProvider({ children, readOnly = false }) {
  const sharedState = getSharedState()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const [collabUnlocked, setCollabUnlocked] = useState(false)
  const [cloudToast, setCloudToast] = useState(null) // null | 'synced' | 'newer'
  const [newerCloudState, setNewerCloudState] = useState(null)
  const debouncedSaveRef = useRef(null)

  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => {
      if (sharedState) return {
        ...buildInitialState(), ...migrateState(sharedState),
        // Deep-merge settings so new fields from DEFAULT_SETTINGS survive version upgrades
        settings: { ...DEFAULT_SETTINGS, ...migrateState(sharedState)?.settings },
        undoPast: [], undoFuture: [],
      }
      const stored = loadFromStorage()
      if (stored) return {
        ...buildInitialState(), ...migrateState(stored),
        // Deep-merge settings so new fields from DEFAULT_SETTINGS survive version upgrades
        settings: { ...DEFAULT_SETTINGS, ...migrateState(stored)?.settings },
        undoPast: [], undoFuture: [],
      }
      return buildInitialState()
    }
  )

  // ── Cloud sync: load when userId becomes available ────────────────────────
  useEffect(() => {
    logger.debug('sync', 'sync effect fired', { userId, hasSharedState: !!sharedState })
    if (sharedState || !userId) return

    loadFromCloud(userId).then(cloud => {
      if (!cloud) {
        const hasLocalEvents = Object.keys(state.events || {}).length > 0
        if (hasLocalEvents) {
          logger.info('sync', 'no cloud data — uploading local state with events')
          saveToCloud(userId, state).then(() => {
            setCloudToast('synced')
            setTimeout(() => setCloudToast(null), 3500)
          })
        } else {
          logger.info('sync', 'no cloud data and no local events — skipping upload')
        }
        return
      }

      const localRaw = localStorage.getItem(getStorageKey())
      const localSavedAt = localRaw ? JSON.parse(localRaw)?._savedAt : null
      logger.debug('sync', 'comparing timestamps', { cloudUpdatedAt: cloud.updatedAt, localSavedAt })

      if (!localSavedAt || new Date(cloud.updatedAt) > new Date(localSavedAt)) {
        logger.info('sync', 'cloud is newer — showing prompt')
        setNewerCloudState(cloud.data)
        setCloudToast('newer')
      } else {
        logger.info('sync', 'local is same or newer — no prompt needed')
      }
    }).catch(err => logger.error('sync', 'cloud load failed', { error: err?.message }))
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cloud sync: save on every state change (debounced 2s) ─────────────────
  useEffect(() => {
    if (sharedState || !userId) return
    if (!debouncedSaveRef.current) {
      debouncedSaveRef.current = debounce((s, uid) => saveToCloud(uid, s), 2000)
    }
    debouncedSaveRef.current(state, userId)
  }, [state, userId, sharedState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply theme CSS variables whenever theme changes ───────────────────────
  useEffect(() => {
    const theme = getTheme(
      state.settings.theme,
      state.settings.customPrimary,
      state.settings.customAccent
    )
    applyThemeToCss(theme)
  }, [state.settings.theme, state.settings.customPrimary, state.settings.customAccent])

  // Auto-save to localStorage on every state change (stamp with time for cloud comparison)
  useEffect(() => {
    if (!sharedState) saveToStorage({ ...state, _savedAt: new Date().toISOString() })
  }, [state, sharedState])

  // Keyboard undo/redo
  useEffect(() => {
    const handler = (e) => {
      if (readOnly) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }) }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); dispatch({ type: 'REDO' }) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readOnly])

  const academicMonths = useMemo(
    () => getAcademicMonths(state.settings.academicYear),
    [state.settings.academicYear]
  )

  function acceptCloudVersion() {
    if (!newerCloudState) return
    const migrated = migrateState(newerCloudState)
    dispatch({ type: 'LOAD_STATE', state: {
      ...buildInitialState(), ...migrated,
      settings: { ...DEFAULT_SETTINGS, ...migrated?.settings },
      undoPast: [], undoFuture: [],
    }})
    setNewerCloudState(null)
    setCloudToast(null)
  }

  function dismissCloudToast() {
    setNewerCloudState(null)
    setCloudToast(null)
  }

  const value = {
    state,
    dispatch,
    readOnly: readOnly || (!!sharedState && !collabUnlocked) || state.settings.locked,
    isSharedView: !!sharedState,
    canUndo: state.undoPast.length > 0,
    canRedo: state.undoFuture.length > 0,
    collabUnlocked,
    setCollabUnlocked,
    academicMonths,
    cloudToast,
    newerCloudState,
    acceptCloudVersion,
    dismissCloudToast,
  }

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider')
  return ctx
}
