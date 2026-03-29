import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { DEFAULT_CATEGORIES } from '../data/defaultCategories.js'
import { DEFAULT_EVENTS } from '../data/defaultEvents.js'
import { nanoid } from '../utils/nanoid.js'
import { getSharedState } from '../utils/shareUrl.js'

// ── Default school info ───────────────────────────────────────────────────
const DEFAULT_SCHOOL_INFO = {
  name: 'Yeshiva Aharon Yaakov Ohr Eliyahu',
  address: '241 S. Detroit St., Los Angeles, CA 90036',
  phone: '323-556-6900',
  fax: '323-556-6901',
  logo: null,
  hours: 'Boys: 8:30 AM – 4:00 PM\nGirls: 8:30 AM – 3:30 PM\nFriday: 8:30 AM – 1:30 PM',
}

const DEFAULT_SETTINGS = {
  shabbatLabel: 'Shabbat',
  shabbatHighlight: true,
  theme: 'navy-gold',
  academicYear: '2026-2027',
  locked: false,
  draftWatermark: false,
  monthNotes: {},
  template: 'classic',
  cellStyle: 'dots',      // 'dots' | 'filled'
  eventsPanel: 'inline', // 'inline' | 'bottom'
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
  const events = normalizeEvents(DEFAULT_EVENTS)
  return {
    events,
    categories: DEFAULT_CATEGORIES,
    schoolInfo: DEFAULT_SCHOOL_INFO,
    settings: DEFAULT_SETTINGS,
    hebrewEventToggles: {},
    undoPast: [],
    undoFuture: [],
  }
}

// ── Load from localStorage ───────────────────────────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem('yayoe-calendar-v1')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

// Strip legacy Rosh Chodesh events and remap old early-dismissal category ids
const EARLY_LEGACY_IDS = new Set(['early-130', 'early-1200', 'early-1130'])
const EARLY_DISMISSAL_DEFAULT = { id: 'early-dismissal', name: 'Early Dismissal', color: '#A8E6CF', icon: '🕐', visible: true, deletable: true }

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
    result.categories = filtered
  }
  return result
}

function saveToStorage(state) {
  try {
    const { undoPast, undoFuture, ...toSave } = state
    localStorage.setItem('yayoe-calendar-v1', JSON.stringify(toSave))
  } catch {}
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

  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => {
      if (sharedState) return { ...buildInitialState(), ...migrateState(sharedState), undoPast: [], undoFuture: [] }
      const stored = loadFromStorage()
      if (stored) return { ...buildInitialState(), ...migrateState(stored), undoPast: [], undoFuture: [] }
      return buildInitialState()
    }
  )

  // Auto-save to localStorage on every state change (skip undo stacks)
  useEffect(() => {
    if (!sharedState) saveToStorage(state)
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

  const value = {
    state,
    dispatch,
    readOnly: readOnly || !!sharedState || state.settings.locked,
    isSharedView: !!sharedState,
    canUndo: state.undoPast.length > 0,
    canRedo: state.undoFuture.length > 0,
  }

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider')
  return ctx
}
