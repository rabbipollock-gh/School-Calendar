const _sessionStart = new Date().toISOString()
let _dispatchCount = 0
let _lastDispatchAt = null
const _exportHistory = [] // { format, label, ts }

export function incrementDispatch() {
  _dispatchCount++
  _lastDispatchAt = new Date().toISOString()
}

export function recordExport(format, label) {
  _exportHistory.unshift({ format, label, ts: new Date().toISOString() })
  if (_exportHistory.length > 10) _exportHistory.length = 10
}

export function getSessionMetrics() {
  return {
    sessionStart: _sessionStart,
    dispatchCount: _dispatchCount,
    lastDispatchAt: _lastDispatchAt,
    exportHistory: [..._exportHistory],
  }
}
