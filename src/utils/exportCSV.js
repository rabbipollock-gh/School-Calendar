import { saveAs } from 'file-saver'
import { parseDateKey } from './dateUtils.js'

/**
 * Export all calendar events as a CSV file
 */
export function exportCSV(events, categories, schoolName = 'YAYOE') {
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const rows = [['Month', 'Date', 'Day', 'Time', 'Category', 'Label']]

  const sortedKeys = Object.keys(events).sort()
  sortedKeys.forEach(dateKey => {
    const dayEvents = events[dateKey]
    if (!Array.isArray(dayEvents)) return
    dayEvents.forEach(ev => {
      const date = parseDateKey(dateKey)
      const month = date.toLocaleString('default', { month: 'long', year: 'numeric' })
      const dayName = date.toLocaleString('default', { weekday: 'short' })
      const cat = catMap[ev.category]
      rows.push([
        month,
        dateKey,
        dayName,
        ev.time || '',
        cat?.name || ev.category,
        ev.label || '',
      ])
    })
  })

  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const filename = `${schoolName.replace(/\s+/g, '-')}-calendar.csv`
  saveAs(blob, filename)
}
