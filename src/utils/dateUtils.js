// Date utilities for YAYOE Calendar Builder

/**
 * Returns array of all days in a month as Date objects
 */
export function getDaysInMonth(year, month) {
  const days = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

/**
 * Returns the day-of-week (0=Sun) of the 1st of the month
 */
export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay()
}

/**
 * Formats a Date (or year/month/day) to "YYYY-MM-DD"
 */
export function formatDateKey(dateOrYear, month, day) {
  if (dateOrYear instanceof Date) {
    const y = dateOrYear.getFullYear()
    const m = String(dateOrYear.getMonth() + 1).padStart(2, '0')
    const d = String(dateOrYear.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return `${dateOrYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Parses "YYYY-MM-DD" back to a local Date object
 */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Returns array of "YYYY-MM-DD" strings for all dates between start and end (inclusive)
 */
export function getDateRange(startKey, endKey) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  const dates = []
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(formatDateKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

/**
 * Groups an array of sorted "YYYY-MM-DD" strings into consecutive ranges
 * e.g. ['2027-04-16','2027-04-17','2027-04-19'] → [['2027-04-16','2027-04-17'], ['2027-04-19']]
 */
export function groupConsecutiveDates(dateKeys) {
  if (!dateKeys || dateKeys.length === 0) return []
  const sorted = [...dateKeys].sort()
  const groups = []
  let currentGroup = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDateKey(sorted[i - 1])
    const curr = parseDateKey(sorted[i])
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24)
    if (diffDays === 1) {
      currentGroup.push(sorted[i])
    } else {
      groups.push(currentGroup)
      currentGroup = [sorted[i]]
    }
  }
  groups.push(currentGroup)
  return groups
}

/**
 * Formats a range group as a display string, e.g. "Apr 16–30" or "Apr 16"
 */
export function formatRangeLabel(dateKeys) {
  if (!dateKeys || dateKeys.length === 0) return ''
  const start = parseDateKey(dateKeys[0])
  const end = parseDateKey(dateKeys[dateKeys.length - 1])
  const startDay = start.getDate()
  const endDay = end.getDate()
  const monthName = start.toLocaleString('default', { month: 'short' })
  if (dateKeys.length === 1) return `${monthName} ${startDay}`
  if (start.getMonth() === end.getMonth()) return `${monthName} ${startDay}–${endDay}`
  const endMonth = end.toLocaleString('default', { month: 'short' })
  return `${monthName} ${startDay}–${endMonth} ${endDay}`
}

/**
 * Formats multiple consecutive-date groups into a compact string,
 * suppressing the month name on same-month follow-on groups.
 * e.g. [["2026-08-20","2026-08-21"],["2026-08-24","2026-08-25"]] → "Aug 20–21, 24–25"
 */
export function formatRangeGroups(groups) {
  let lastMonth = -1
  return groups.map(g => {
    if (!g || g.length === 0) return ''
    const start = parseDateKey(g[0])
    const end = parseDateKey(g[g.length - 1])
    const startDay = start.getDate()
    const endDay = end.getDate()
    const startMonth = start.getMonth()
    const endMonth = end.getMonth()
    const monthName = start.toLocaleString('default', { month: 'short' })
    const sameAsLast = startMonth === lastMonth
    lastMonth = endMonth
    if (g.length === 1) return sameAsLast ? `${startDay}` : `${monthName} ${startDay}`
    if (startMonth === endMonth) return sameAsLast ? `${startDay}–${endDay}` : `${monthName} ${startDay}–${endDay}`
    const endMonthName = end.toLocaleString('default', { month: 'short' })
    return sameAsLast ? `${startDay}–${endMonthName} ${endDay}` : `${monthName} ${startDay}–${endMonthName} ${endDay}`
  }).filter(Boolean).join(', ')
}

/**
 * Returns the month key "YYYY-MM" from a date key
 */
export function getMonthKey(dateKey) {
  return dateKey.slice(0, 7)
}

/**
 * Checks if a date key falls on a Saturday (Shabbat)
 */
export function isShabbat(dateKey) {
  return parseDateKey(dateKey).getDay() === 6
}

/**
 * Returns short month name + year, e.g. "August 2026"
 */
export function getMonthTitle(year, month) {
  return new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

/**
 * Formats a "HH:MM" 24-hour time string to 12-hour display, e.g. "1:30pm"
 */
export function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2, '0')}${ampm}`
}
