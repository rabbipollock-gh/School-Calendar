import LZString from 'lz-string'

/**
 * Encode full calendar state into a compressed URL-safe base64 string
 */
export function encodeCalendarState(state) {
  try {
    const json = JSON.stringify(state)
    return LZString.compressToEncodedURIComponent(json)
  } catch (e) {
    console.error('encodeCalendarState failed:', e)
    return null
  }
}

/**
 * Decode compressed state from a URL param
 */
export function decodeCalendarState(encoded) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    return JSON.parse(json)
  } catch (e) {
    console.error('decodeCalendarState failed:', e)
    return null
  }
}

/**
 * Generate a full shareable URL with the calendar state embedded
 */
export function generateShareUrl(state) {
  const encoded = encodeCalendarState(state)
  if (!encoded) return null
  const base = window.location.origin + window.location.pathname
  return `${base}?cal=${encoded}`
}

/**
 * Check if the current URL contains a shared calendar state
 * Returns the decoded state or null
 */
export function getSharedState() {
  const params = new URLSearchParams(window.location.search)
  const cal = params.get('cal')
  if (!cal) return null
  return decodeCalendarState(cal)
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  }
}
