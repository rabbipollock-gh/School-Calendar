import { saveAs } from 'file-saver'
import { parseDateKey } from './dateUtils.js'

/**
 * Export events as a .ics file
 * @param {Object} events - { [dateKey]: EventObject[] }
 * @param {Array} categories - category objects
 * @param {string} filterMode - 'all' | 'no-school' | category id
 * @param {string} schoolName - school name for calendar title
 */
export async function exportICS(events, categories, filterMode = 'all', schoolName = 'YAYOE') {
  const { createEvents } = await import('ics')

  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  const icsEvents = []

  Object.entries(events).forEach(([dateKey, dayEvents]) => {
    if (!Array.isArray(dayEvents)) return
    dayEvents.forEach(ev => {
      // Apply filter
      if (filterMode === 'no-school' && ev.category !== 'no-school') return
      if (filterMode !== 'all' && filterMode !== 'no-school' && ev.category !== filterMode) return

      const date = parseDateKey(dateKey)
      const cat = catMap[ev.category]

      if (ev.time) {
        // Timed event
        const [hh, mm] = ev.time.split(':').map(Number)
        icsEvents.push({
          start: [date.getFullYear(), date.getMonth() + 1, date.getDate(), hh, mm],
          duration: { hours: 1 },
          title: ev.label,
          description: cat?.name || ev.category,
          categories: [cat?.name || ev.category],
          status: 'CONFIRMED',
          busyStatus: 'BUSY',
        })
      } else {
        // All-day event
        icsEvents.push({
          start: [date.getFullYear(), date.getMonth() + 1, date.getDate()],
          end: [date.getFullYear(), date.getMonth() + 1, date.getDate()],
          title: ev.label,
          description: cat?.name || ev.category,
          categories: [cat?.name || ev.category],
          status: 'CONFIRMED',
          busyStatus: 'FREE',
        })
      }
    })
  })

  if (icsEvents.length === 0) {
    alert('No events match the selected filter.')
    return
  }

  const { error, value } = createEvents(icsEvents)
  if (error) {
    console.error('ICS creation error:', error)
    alert('Failed to generate calendar file.')
    return
  }

  const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' })
  const filename = `${schoolName.replace(/\s+/g, '-')}-calendar-${filterMode}.ics`
  saveAs(blob, filename)
}
