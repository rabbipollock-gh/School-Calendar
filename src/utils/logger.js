/**
 * Structured logger — Phase 9
 *
 * API:
 *   logger.debug(category, message, metadata?)
 *   logger.info(category, message, metadata?)
 *   logger.warn(category, message, metadata?)
 *   logger.error(category, message, metadata?)
 *   logger.flush()   — sends buffered logs to Supabase (when implemented)
 *
 * Categories: 'auth' | 'sync' | 'pdf' | 'ui' | 'general'
 * Log levels:  'debug' < 'info' < 'warn' < 'error'
 *
 * In production: logs are held in memory (max 100) and also forwarded to
 * the existing errorLog.js buffer (which DiagnosticsModal reads).
 * In development (import.meta.env.DEV): also writes to console.
 *
 * Future: logger.flush() will POST batches to a Supabase Edge Function
 * (Phase 9 full implementation — the infrastructure is ready here).
 */

import { APP_VERSION } from '../version.js'
import { _pushToLog } from './errorLog.js'

// ── In-memory buffer ──────────────────────────────────────────────────────
const MAX_ENTRIES = 100
const _buffer = []

// Level ordering for filtering
const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 }

/**
 * Production debug switch. Set `localStorage['yayoe-debug'] = '1'` and reload to
 * get full console output on a deployed build — the only practical way to
 * diagnose a sync problem that only reproduces on a real origin with a real
 * session. Unset it (or use a private window) to go quiet again.
 */
const DEBUG_ENABLED = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('yayoe-debug') === '1'
  } catch {
    return false
  }
})()

const VERBOSE = import.meta.env.DEV || DEBUG_ENABLED

// In prod, skip debug-level entries from the buffer to reduce noise
const MIN_LEVEL = VERBOSE ? 'debug' : 'info'

function _push(level, category, message, metadata = null) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return

  const entry = {
    ts: new Date().toISOString(),
    level,
    category: category || 'general',
    message: String(message),
    metadata: metadata || undefined,
    app_version: APP_VERSION,
  }

  _buffer.push(entry)
  if (_buffer.length > MAX_ENTRIES) _buffer.shift()

  // Forward to console in dev, or in prod when the debug switch is on
  if (VERBOSE) {
    const prefix = `[${entry.category.toUpperCase()}]`
    if (level === 'error') console.error(prefix, message, metadata || '')
    else if (level === 'warn') console.warn(prefix, message, metadata || '')
    else console.log(`[${level.toUpperCase()}] ${prefix}`, message, metadata || '')
  }

  // Also mirror warn/error into errorLog buffer so DiagnosticsModal shows them
  if (level === 'warn' || level === 'error') {
    try { _pushToLog(level, [String(message)]) } catch {}
  }
}

// ── Public logger API ─────────────────────────────────────────────────────
export const logger = {
  debug: (category, message, metadata) => _push('debug', category, message, metadata),
  info:  (category, message, metadata) => _push('info',  category, message, metadata),
  warn:  (category, message, metadata) => _push('warn',  category, message, metadata),
  error: (category, message, metadata) => _push('error', category, message, metadata),

  /** Returns a copy of the in-memory log buffer */
  getBuffer: () => [..._buffer],

  /** Clears the in-memory buffer */
  clearBuffer: () => { _buffer.length = 0 },

  /**
   * Flush buffered logs to Supabase Edge Function.
   * Currently a no-op placeholder — will be wired up when the
   * `log-ingest` Edge Function is deployed (Phase 9 full impl).
   */
  flush: async () => {
    // TODO (Phase 9 full): POST _buffer to /functions/v1/log-ingest
    // const supabase = getSupabaseClient()
    // await supabase.functions.invoke('log-ingest', { body: { logs: _buffer } })
    // _buffer.length = 0
  },
}

export default logger
