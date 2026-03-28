/**
 * Build a flat searchable index from all calendar events
 */
export function buildSearchIndex(events, categories) {
  const index = []
  const catMap = {}
  categories.forEach(c => { catMap[c.id] = c })

  Object.entries(events).forEach(([dateKey, dayEvents]) => {
    if (!Array.isArray(dayEvents)) return
    dayEvents.forEach(ev => {
      const cat = catMap[ev.category]
      if (!ev.label) return
      index.push({
        dateKey,
        id: ev.id,
        label: ev.label.toLowerCase(),
        labelDisplay: ev.label,
        categoryId: ev.category,
        categoryName: cat?.name || ev.category,
        categoryColor: cat?.color || '#999',
      })
    })
  })
  return index
}

/**
 * Search the index for a query string (case-insensitive, partial match)
 * Returns up to 20 results sorted by date
 */
export function searchEvents(query, index) {
  if (!query || query.trim().length < 1) return []
  const q = query.toLowerCase().trim()
  return index
    .filter(item => item.label.includes(q) || item.categoryName.toLowerCase().includes(q))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(0, 20)
}
