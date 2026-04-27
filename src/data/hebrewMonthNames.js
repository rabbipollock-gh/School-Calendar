// Hebrew month names per Gregorian month for academic year 2026–2027
// Each entry: { primary, secondary } — shown in month header as "Primary–Secondary"
export const HEBREW_MONTH_NAMES = {
  '2026-08': { primary: 'Av', secondary: 'Elul' },
  '2026-09': { primary: 'Elul', secondary: 'Tishrei' },
  '2026-10': { primary: 'Tishrei', secondary: 'Cheshvan' },
  '2026-11': { primary: 'Cheshvan', secondary: 'Kislev' },
  '2026-12': { primary: 'Kislev', secondary: 'Tevet' },
  '2027-01': { primary: 'Tevet', secondary: 'Shvat' },
  '2027-02': { primary: 'Shvat', secondary: 'Adar' },
  '2027-03': { primary: 'Adar', secondary: 'Nissan' },
  '2027-04': { primary: 'Nissan', secondary: 'Iyar' },
  '2027-05': { primary: 'Iyar', secondary: 'Sivan' },
  '2027-06': { primary: 'Sivan', secondary: 'Tammuz' },
}

// Ashkenaz spelling variants for Hebrew month names
const ASHKENAZ_MONTH_MAP = {
  'Tevet': 'Teves',
}

function applyAshkenazMonth(name, isAshkenaz) {
  if (!isAshkenaz) return name
  return ASHKENAZ_MONTH_MAP[name] || name
}

export function getHebrewMonthLabel(year, month, shabbatLabel) {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`
  const entry = HEBREW_MONTH_NAMES[key]
  if (!entry) return ''
  const isAshkenaz = shabbatLabel === 'Shabbos'
  const primary = applyAshkenazMonth(entry.primary, isAshkenaz)
  const secondary = entry.secondary ? applyAshkenazMonth(entry.secondary, isAshkenaz) : null
  return secondary ? `${primary}–${secondary}` : primary
}
