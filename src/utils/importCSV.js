import { formatDateKey } from './dateUtils.js'
import { nanoid } from './nanoid.js'

// Parse a date string in various formats → Date object or null
function parseDate(str) {
  if (!str) return null
  str = str.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  // M/D/YYYY or MM/DD/YYYY or M/D/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
    const [m, d, y] = str.split('/').map(Number)
    const fullYear = y < 100 ? 2000 + y : y
    return new Date(fullYear, m - 1, d)
  }

  // Try native parse as last resort
  const parsed = new Date(str)
  return isNaN(parsed) ? null : parsed
}

// Find best-matching category id from the calendar's categories list
function resolveCategory(categoryStr, categories) {
  if (!categoryStr) return 'school-event'
  const lower = categoryStr.toLowerCase().trim()

  // Exact id match
  const byId = categories.find(c => c.id === lower)
  if (byId) return byId.id

  // Partial name match
  const byName = categories.find(c => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
  if (byName) return byName.id

  return 'school-event'  // default
}

// Parse CSV text → array of { dateKey, event } objects
// Supported columns: Date, Label/Event/Name, Category (all optional header row)
export function parseCSV(text, categories) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'))
  if (lines.length === 0) return { events: [], errors: [] }

  // Detect if first row is a header
  const firstCell = lines[0].split(',')[0].trim().toLowerCase()
  const hasHeader = isNaN(Date.parse(firstCell)) && !/^\d/.test(firstCell)
  const dataLines = hasHeader ? lines.slice(1) : lines

  const events = []
  const errors = []

  dataLines.forEach((line, i) => {
    // Handle quoted fields
    const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$)/g)?.map(c =>
      c.trim().replace(/^"|"$/g, '').trim()
    ) || line.split(',').map(c => c.trim())

    const [dateStr, labelStr, categoryStr, timeStr] = cols
    const date = parseDate(dateStr)

    if (!date) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: couldn't parse date "${dateStr}"`)
      return
    }

    const label = (labelStr || '').trim()
    if (!label) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: missing event label`)
      return
    }

    events.push({
      dateKey: formatDateKey(date),
      event: {
        id: 'ev-' + nanoid(),
        label,
        category: resolveCategory(categoryStr, categories),
        time: timeStr?.trim() || undefined,
      },
    })
  })

  return { events, errors }
}
