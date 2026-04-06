/**
 * Returns the 11 academic months (Aug–Jun) for a given academic year string.
 * @param {string} academicYear  e.g. "2026-2027"
 * @returns {{ year: number, month: number }[]}
 */
export function getAcademicMonths(academicYear) {
  const [startYearStr] = (academicYear || '2026-2027').split('-')
  const startYear = parseInt(startYearStr, 10) || 2026
  const endYear = startYear + 1
  return [
    { year: startYear, month: 7 },  // August
    { year: startYear, month: 8 },  // September
    { year: startYear, month: 9 },  // October
    { year: startYear, month: 10 }, // November
    { year: startYear, month: 11 }, // December
    { year: endYear,   month: 0 },  // January
    { year: endYear,   month: 1 },  // February
    { year: endYear,   month: 2 },  // March
    { year: endYear,   month: 3 },  // April
    { year: endYear,   month: 4 },  // May
    { year: endYear,   month: 5 },  // June
  ]
}
