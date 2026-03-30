// Returns the school code from the URL hash (e.g. /#yayoe → 'yayoe')
// Only allows alphanumeric + hyphens, lowercase
export function getSchoolCode() {
  const hash = window.location.hash.slice(1).trim()
  if (!hash) return null
  const clean = hash.toLowerCase().replace(/[^a-z0-9-]/g, '')
  return clean || null
}

// Converts a school name to a URL-safe slug (e.g. "Hillel Academy" → "hillel-academy")
export function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
