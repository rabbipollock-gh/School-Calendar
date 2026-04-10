// In-memory rolling log — captures console.error and console.warn
// Max 50 entries, cleared on page reload (intentional — no persistence needed)

const MAX_ENTRIES = 50
const _log = []
let _lastCloudSave = null

// Intercept console methods
const _origError = console.error.bind(console)
const _origWarn = console.warn.bind(console)
const _origLog = console.log.bind(console)

function push(level, args) {
  _log.push({
    ts: new Date().toISOString(),
    level,
    msg: args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
  })
  if (_log.length > MAX_ENTRIES) _log.shift()
}

console.error = (...args) => { push('error', args); _origError(...args) }
console.warn  = (...args) => { push('warn',  args); _origWarn(...args)  }
console.log   = (...args) => {
  // Only capture cloud-sync logs to keep info entries useful
  const msg = args[0]
  if (typeof msg === 'string' && msg.startsWith('[CloudSync]')) {
    push('info', args)
    if (msg.includes('saved to cloud')) _lastCloudSave = new Date().toISOString()
  }
  _origLog(...args)
}

export function getLog() {
  return [..._log]
}

export function getLastCloudSave() {
  return _lastCloudSave
}

export function clearLog() {
  _log.length = 0
}
