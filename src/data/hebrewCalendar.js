// Hebrew calendar data for 5787 (Aug 2026 – Jun 2027) and 5788 (Aug 2027 – Jun 2028)
// Rosh Chodesh dates and major holiday suggestions

// ── Corrected Rosh Chodesh dates for 5787 ────────────────────────────────
// Anchored on: 1 Tishrei = Sept 12; Asara B'Tevet Dec 20; Purim Mar 23; Shavuos Jun 11
// 5787 is a LEAP YEAR — contains both Adar I and Adar II
// Tishrei RC is skipped (= Rosh Hashana, already a major holiday)
// Tammuz RC (Jul 5-6) is after the school year — omitted from badge map
const ROSH_CHODESH_DATES_5787 = [
  // Elul 5786 — just before the academic year begins
  { date: '2026-08-13', month: 'Elul',    id: 'rc-elul-1' },
  { date: '2026-08-14', month: 'Elul',    id: 'rc-elul-2' },
  // Cheshvan
  { date: '2026-10-11', month: 'Cheshvan', id: 'rc-cheshvan-1' },
  { date: '2026-10-12', month: 'Cheshvan', id: 'rc-cheshvan-2' },
  // Kislev
  { date: '2026-11-10', month: 'Kislev',  id: 'rc-kislev-1' },
  { date: '2026-11-11', month: 'Kislev',  id: 'rc-kislev-2' },
  // Tevet
  { date: '2026-12-10', month: 'Tevet',   id: 'rc-tevet-1' },
  { date: '2026-12-11', month: 'Tevet',   id: 'rc-tevet-2' },
  // Shvat (Tevet has 29 days → single-day RC: just 1 Shvat = Jan 9)
  { date: '2027-01-09', month: 'Shvat',   id: 'rc-shvat' },
  // Adar I (leap year)
  { date: '2027-02-07', month: 'Adar I',  id: 'rc-adar1-1' },
  { date: '2027-02-08', month: 'Adar I',  id: 'rc-adar1-2' },
  // Adar II (leap year)
  { date: '2027-03-09', month: 'Adar II', id: 'rc-adar2-1' },
  { date: '2027-03-10', month: 'Adar II', id: 'rc-adar2-2' },
  // Nissan (Adar II has 29 days → single-day RC)
  { date: '2027-04-08', month: 'Nissan',  id: 'rc-nissan' },
  // Iyar
  { date: '2027-05-07', month: 'Iyar',    id: 'rc-iyar-1' },
  { date: '2027-05-08', month: 'Iyar',    id: 'rc-iyar-2' },
  // Sivan
  { date: '2027-06-05', month: 'Sivan',   id: 'rc-sivan-1' },
  { date: '2027-06-06', month: 'Sivan',   id: 'rc-sivan-2' },
]

// ── Rosh Chodesh dates for 5788 ───────────────────────────────────────────
// Anchored on: 1 Tishrei = Oct 2, 2027; Chanukah starts Dec 25; Pesach Apr 11, 2028; Shavuot May 31
// 5788 is a REGULAR (non-leap) year — single Adar
// Cheshvan = 30 days, Kislev = 30 days (verified against Chanukah/Pesach anchors)
// Tishrei RC is skipped (= Rosh Hashana)
// Tammuz RC (Jun 24-25) is after the school year — omitted
const ROSH_CHODESH_DATES_5788 = [
  // Av 5787 — just before the academic year begins (Tammuz = 29 days → single day)
  { date: '2027-08-04', month: 'Av',       id: 'rc-av-5788' },
  // Elul 5787 — Av = 30 days → two days
  { date: '2027-09-02', month: 'Elul',     id: 'rc-elul-5788-1' },
  { date: '2027-09-03', month: 'Elul',     id: 'rc-elul-5788-2' },
  // Cheshvan — Tishrei = 30 days → two days
  { date: '2027-10-31', month: 'Cheshvan', id: 'rc-cheshvan-5788-1' },
  { date: '2027-11-01', month: 'Cheshvan', id: 'rc-cheshvan-5788-2' },
  // Kislev — Cheshvan = 30 days → two days
  { date: '2027-11-30', month: 'Kislev',   id: 'rc-kislev-5788-1' },
  { date: '2027-12-01', month: 'Kislev',   id: 'rc-kislev-5788-2' },
  // Tevet — Kislev = 30 days → two days
  { date: '2027-12-30', month: 'Tevet',    id: 'rc-tevet-5788-1' },
  { date: '2027-12-31', month: 'Tevet',    id: 'rc-tevet-5788-2' },
  // Shvat — Tevet = 29 days → single day
  { date: '2028-01-29', month: 'Shvat',    id: 'rc-shvat-5788' },
  // Adar — Shvat = 30 days → two days
  { date: '2028-02-27', month: 'Adar',     id: 'rc-adar-5788-1' },
  { date: '2028-02-28', month: 'Adar',     id: 'rc-adar-5788-2' },
  // Nissan — Adar = 29 days → single day
  { date: '2028-03-28', month: 'Nissan',   id: 'rc-nissan-5788' },
  // Iyar — Nissan = 30 days → two days
  { date: '2028-04-26', month: 'Iyar',     id: 'rc-iyar-5788-1' },
  { date: '2028-04-27', month: 'Iyar',     id: 'rc-iyar-5788-2' },
  // Sivan — Iyar = 29 days → single day
  { date: '2028-05-26', month: 'Sivan',    id: 'rc-sivan-5788' },
]

// Fast lookup map: dateKey → Hebrew month name (for DayCell badge)
export const ROSH_CHODESH_MAP = {}
ROSH_CHODESH_DATES_5787.forEach(rc => { ROSH_CHODESH_MAP[rc.date] = rc.month })

const ROSH_CHODESH_MAP_5788 = {}
ROSH_CHODESH_DATES_5788.forEach(rc => { ROSH_CHODESH_MAP_5788[rc.date] = rc.month })

/** Returns the Rosh Chodesh lookup map for the given academic year string (e.g. "2026-2027") */
export function getRoshChodeshMap(academicYear) {
  if (academicYear === '2027-2028') return ROSH_CHODESH_MAP_5788
  return ROSH_CHODESH_MAP
}


// ── Hebrew Holiday Icon Badges ────────────────────────────────────────────
// Groups used for per-toggle settings. Names have Ashkenaz/Sephardi variants.
// shabbatLabel === 'Shabbos' → use ashkenaz; 'Shabbat' → use sephardi.
export const HEBREW_HOLIDAY_GROUPS = [
  { id: 'rosh-hashana',   ashkenaz: 'Rosh Hashana',   sephardi: 'Rosh Hashana',   icon: '🍎' },
  { id: 'yom-kippur',     ashkenaz: 'Yom Kippur',     sephardi: 'Yom Kippur',     icon: '📿' },
  { id: 'sukkos',         ashkenaz: 'Sukkos',         sephardi: 'Sukkot',         icon: '🌿' },
  { id: 'chanuka',        ashkenaz: 'Chanukah',       sephardi: 'Chanukah',       icon: '🕎' },
  { id: 'purim',          ashkenaz: 'Purim',          sephardi: 'Purim',          icon: '🎭' },
  { id: 'pesach',         ashkenaz: 'Pesach',         sephardi: 'Pesach',         icon: '🫓' },
  { id: 'shavuos',        ashkenaz: 'Shavuos',        sephardi: 'Shavuot',        icon: '📜' },
  { id: 'minor-fasts',    ashkenaz: 'Fast Day',       sephardi: 'Fast Day',       icon: '⏰' },
  { id: 'tu-bshvat',      ashkenaz: "Tu B'Shvat",     sephardi: "Tu B'Shvat",     icon: '🌳' },
  { id: 'yom-hazikaron',  ashkenaz: 'Yom HaZikaron',  sephardi: 'Yom HaZikaron',  icon: '🕯️' },
  { id: 'yom-haatzmaut',  ashkenaz: 'Yom HaAtzmaut',  sephardi: 'Yom HaAtzmaut',  icon: '🇮🇱' },
  { id: 'lag-baomer',     ashkenaz: "Lag B'Omer",     sephardi: "Lag B'Omer",     icon: '🔥' },
]

// Fast lookup: dateKey → { group, ashkenaz, sephardi, icon }
// Covers academic year 5787 (Aug 2026 – Jun 2027)
export const HEBREW_HOLIDAY_MAP = {
  // ── Rosh Hashana ──
  '2026-09-12': { group: 'rosh-hashana', ashkenaz: 'Rosh Hashana', sephardi: 'Rosh Hashana', icon: '🍎' },
  '2026-09-13': { group: 'rosh-hashana', ashkenaz: 'Rosh Hashana', sephardi: 'Rosh Hashana', icon: '🍎' },
  // ── Yom Kippur ──
  '2026-09-21': { group: 'yom-kippur', ashkenaz: 'Yom Kippur', sephardi: 'Yom Kippur', icon: '📿' },
  // ── Sukkos / Sukkot ──
  '2026-09-25': { group: 'sukkos', ashkenaz: 'Sukkos',          sephardi: 'Sukkot',           icon: '🌿' },
  '2026-09-26': { group: 'sukkos', ashkenaz: 'Sukkos',          sephardi: 'Sukkot',           icon: '🌿' },
  '2026-09-27': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2026-09-28': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2026-09-29': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2026-09-30': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2026-10-01': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2026-10-02': { group: 'sukkos', ashkenaz: 'Hoshana Raba',    sephardi: 'Hoshana Raba',     icon: '🌿' },
  '2026-10-03': { group: 'sukkos', ashkenaz: 'Shmini Atzeres',  sephardi: 'Shemini Atzeret',  icon: '🌿' },
  '2026-10-04': { group: 'sukkos', ashkenaz: 'Simchas Torah',   sephardi: 'Simchat Torah',    icon: '📜' },
  // ── Chanukah ──
  '2026-12-05': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  '2026-12-06': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  '2026-12-07': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  '2026-12-08': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  '2026-12-09': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  '2026-12-10': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  '2026-12-11': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  '2026-12-12': { group: 'chanuka', ashkenaz: 'Chanukah',  sephardi: 'Chanukah',  icon: '🕎' },
  // ── Minor Fasts ──
  '2026-09-14': { group: 'minor-fasts', ashkenaz: 'Tzom Gedalya',   sephardi: 'Tzom Gedalyah',  icon: '⏰' },
  '2026-12-20': { group: 'minor-fasts', ashkenaz: "Asara B'Teves",  sephardi: "Asara B'Tevet",  icon: '⏰' },
  '2027-03-22': { group: 'minor-fasts', ashkenaz: 'Taanis Esther',  sephardi: 'Ta\'anit Esther', icon: '⏰' },
  '2027-06-10': { group: 'minor-fasts', ashkenaz: 'Erev Shavuos',   sephardi: 'Erev Shavuot',   icon: '⏰' },
  // ── Purim ──
  '2027-03-23': { group: 'purim', ashkenaz: 'Purim',          sephardi: 'Purim',          icon: '🎭' },
  '2027-03-24': { group: 'purim', ashkenaz: 'Shushan Purim',  sephardi: 'Shushan Purim',  icon: '🎭' },
  // ── Pesach ──
  '2027-04-22': { group: 'pesach', ashkenaz: 'Pesach',       sephardi: 'Pesach',       icon: '🫓' },
  '2027-04-23': { group: 'pesach', ashkenaz: 'Pesach',       sephardi: 'Pesach',       icon: '🫓' },
  '2027-04-24': { group: 'pesach', ashkenaz: 'Chol HaMoed',  sephardi: 'Chol HaMoed',  icon: '🫓' },
  '2027-04-25': { group: 'pesach', ashkenaz: 'Chol HaMoed',  sephardi: 'Chol HaMoed',  icon: '🫓' },
  '2027-04-26': { group: 'pesach', ashkenaz: 'Chol HaMoed',  sephardi: 'Chol HaMoed',  icon: '🫓' },
  '2027-04-27': { group: 'pesach', ashkenaz: 'Chol HaMoed',  sephardi: 'Chol HaMoed',  icon: '🫓' },
  '2027-04-28': { group: 'pesach', ashkenaz: 'Pesach',       sephardi: 'Pesach',       icon: '🫓' },
  '2027-04-29': { group: 'pesach', ashkenaz: 'Pesach',       sephardi: 'Pesach',       icon: '🫓' },
  // ── Shavuos / Shavuot ──
  '2027-06-11': { group: 'shavuos', ashkenaz: 'Shavuos', sephardi: 'Shavuot', icon: '📜' },
  '2027-06-12': { group: 'shavuos', ashkenaz: 'Shavuos', sephardi: 'Shavuot', icon: '📜' },
  // ── Individual Jewish Holidays (each has its own toggle) ──
  '2027-01-22': { group: 'tu-bshvat',     ashkenaz: "Tu B'Shvat",    sephardi: "Tu B'Shvat",    icon: '🌳' },
  '2027-05-11': { group: 'yom-hazikaron', ashkenaz: 'Yom HaZikaron', sephardi: 'Yom HaZikaron', icon: '🕯️' },
  '2027-05-12': { group: 'yom-haatzmaut', ashkenaz: 'Yom HaAtzmaut', sephardi: 'Yom HaAtzmaut', icon: '🇮🇱' },
  '2027-05-25': { group: 'lag-baomer',    ashkenaz: "Lag B'Omer",    sephardi: "Lag B'Omer",    icon: '🔥' },
}

/** Returns the Hebrew holiday date→info map for the given academic year string */
export function getHolidayMap(academicYear) {
  if (academicYear === '2027-2028') return HEBREW_HOLIDAY_MAP_5788
  return HEBREW_HOLIDAY_MAP
}

// ── Hebrew Holiday Map for 5788 (Aug 2027 – Jun 2028) ────────────────────
// Anchored on hebcal.com: RH=Oct 2-3; Chanukah=Dec 25–Jan 1; Pesach=Apr 11-18; Shavuot=May 31–Jun 1
const HEBREW_HOLIDAY_MAP_5788 = {
  // ── Rosh Hashana ──
  '2027-10-02': { group: 'rosh-hashana', ashkenaz: 'Rosh Hashana', sephardi: 'Rosh Hashana', icon: '🍎' },
  '2027-10-03': { group: 'rosh-hashana', ashkenaz: 'Rosh Hashana', sephardi: 'Rosh Hashana', icon: '🍎' },
  // ── Yom Kippur ──
  '2027-10-11': { group: 'yom-kippur', ashkenaz: 'Yom Kippur', sephardi: 'Yom Kippur', icon: '📿' },
  // ── Sukkos / Sukkot ──
  '2027-10-16': { group: 'sukkos', ashkenaz: 'Sukkos',          sephardi: 'Sukkot',           icon: '🌿' },
  '2027-10-17': { group: 'sukkos', ashkenaz: 'Sukkos',          sephardi: 'Sukkot',           icon: '🌿' },
  '2027-10-18': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2027-10-19': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2027-10-20': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2027-10-21': { group: 'sukkos', ashkenaz: 'Chol HaMoed',     sephardi: 'Chol HaMoed',      icon: '🌿' },
  '2027-10-22': { group: 'sukkos', ashkenaz: 'Hoshana Raba',    sephardi: 'Hoshana Raba',     icon: '🌿' },
  '2027-10-23': { group: 'sukkos', ashkenaz: 'Shmini Atzeres',  sephardi: 'Shemini Atzeret',  icon: '🌿' },
  '2027-10-24': { group: 'sukkos', ashkenaz: 'Simchas Torah',   sephardi: 'Simchat Torah',    icon: '📜' },
  // ── Chanukah ──
  '2027-12-25': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  '2027-12-26': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  '2027-12-27': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  '2027-12-28': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  '2027-12-29': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  '2027-12-30': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  '2027-12-31': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  '2028-01-01': { group: 'chanuka', ashkenaz: 'Chanukah', sephardi: 'Chanukah', icon: '🕎' },
  // ── Minor Fasts ──
  '2027-10-04': { group: 'minor-fasts', ashkenaz: 'Tzom Gedalya',   sephardi: 'Tzom Gedalyah',   icon: '⏰' },
  '2028-01-09': { group: 'minor-fasts', ashkenaz: "Asara B'Teves",  sephardi: "Asara B'Tevet",   icon: '⏰' },
  '2028-03-11': { group: 'minor-fasts', ashkenaz: 'Taanis Esther',  sephardi: "Ta'anit Esther",  icon: '⏰' },
  '2028-05-30': { group: 'minor-fasts', ashkenaz: 'Erev Shavuos',   sephardi: 'Erev Shavuot',    icon: '⏰' },
  // ── Purim ──
  '2028-03-12': { group: 'purim', ashkenaz: 'Purim',         sephardi: 'Purim',         icon: '🎭' },
  '2028-03-13': { group: 'purim', ashkenaz: 'Shushan Purim', sephardi: 'Shushan Purim', icon: '🎭' },
  // ── Pesach ──
  '2028-04-11': { group: 'pesach', ashkenaz: 'Pesach',      sephardi: 'Pesach',      icon: '🫓' },
  '2028-04-12': { group: 'pesach', ashkenaz: 'Pesach',      sephardi: 'Pesach',      icon: '🫓' },
  '2028-04-13': { group: 'pesach', ashkenaz: 'Chol HaMoed', sephardi: 'Chol HaMoed', icon: '🫓' },
  '2028-04-14': { group: 'pesach', ashkenaz: 'Chol HaMoed', sephardi: 'Chol HaMoed', icon: '🫓' },
  '2028-04-15': { group: 'pesach', ashkenaz: 'Chol HaMoed', sephardi: 'Chol HaMoed', icon: '🫓' },
  '2028-04-16': { group: 'pesach', ashkenaz: 'Chol HaMoed', sephardi: 'Chol HaMoed', icon: '🫓' },
  '2028-04-17': { group: 'pesach', ashkenaz: 'Pesach',      sephardi: 'Pesach',      icon: '🫓' },
  '2028-04-18': { group: 'pesach', ashkenaz: 'Pesach',      sephardi: 'Pesach',      icon: '🫓' },
  // ── Shavuos / Shavuot ──
  '2028-05-31': { group: 'shavuos', ashkenaz: 'Shavuos', sephardi: 'Shavuot', icon: '📜' },
  '2028-06-01': { group: 'shavuos', ashkenaz: 'Shavuos', sephardi: 'Shavuot', icon: '📜' },
  // ── Individual Jewish Holidays ──
  '2028-02-12': { group: 'tu-bshvat',     ashkenaz: "Tu B'Shvat",    sephardi: "Tu B'Shvat",    icon: '🌳' },
  '2028-04-30': { group: 'yom-hazikaron', ashkenaz: 'Yom HaZikaron', sephardi: 'Yom HaZikaron', icon: '🕯️' },
  '2028-05-01': { group: 'yom-haatzmaut', ashkenaz: 'Yom HaAtzmaut', sephardi: 'Yom HaAtzmaut', icon: '🇮🇱' },
  '2028-05-14': { group: 'lag-baomer',    ashkenaz: "Lag B'Omer",    sephardi: "Lag B'Omer",    icon: '🔥' },
}

// ── Major holiday suggestions — shown as "suggestions" (grayed out) in Holiday Suggestions Panel
// User clicks "Add to calendar" to activate them
export const HOLIDAY_SUGGESTIONS = [
  // Tishrei Holidays
  { id: 'hs-rh1', date: '2026-09-11', label: 'Erev Rosh Hashana', category: 'no-school', hebrewDate: '29 Elul 5786' },
  { id: 'hs-rh2', date: '2026-09-12', label: 'Rosh Hashana', category: 'no-school', hebrewDate: '1 Tishrei 5787' },
  { id: 'hs-rh3', date: '2026-09-13', label: 'Rosh Hashana', category: 'no-school', hebrewDate: '2 Tishrei 5787' },
  { id: 'hs-tzom', date: '2026-09-14', label: 'Tzom Gedalya', category: 'early-dismissal', hebrewDate: '3 Tishrei 5787' },
  { id: 'hs-yk1', date: '2026-09-20', label: 'Erev Yom Kippur', category: 'no-school', hebrewDate: '9 Tishrei 5787' },
  { id: 'hs-yk2', date: '2026-09-21', label: 'Yom Kippur', category: 'no-school', hebrewDate: '10 Tishrei 5787' },
  { id: 'hs-suk1', date: '2026-09-25', label: 'Sukkos (1st Day)', category: 'no-school', hebrewDate: '15 Tishrei 5787' },
  { id: 'hs-suk2', date: '2026-09-26', label: 'Sukkos (2nd Day)', category: 'no-school', hebrewDate: '16 Tishrei 5787' },
  { id: 'hs-hoshana', date: '2026-10-02', label: 'Hoshana Raba', category: 'no-school', hebrewDate: '21 Tishrei 5787' },
  { id: 'hs-smini', date: '2026-10-03', label: 'Shmini Atzeres', category: 'no-school', hebrewDate: '22 Tishrei 5787' },
  { id: 'hs-simcha', date: '2026-10-04', label: 'Simchas Torah', category: 'no-school', hebrewDate: '23 Tishrei 5787' },

  // Kislev / Tevet
  { id: 'hs-chan1', date: '2026-12-05', label: 'Chanukah (1st Night)', category: 'chanukah', hebrewDate: '25 Kislev 5787' },
  { id: 'hs-chan2', date: '2026-12-06', label: 'Chanukah (2nd Night)', category: 'chanukah', hebrewDate: '26 Kislev 5787' },
  { id: 'hs-chan3', date: '2026-12-07', label: 'Chanukah (3rd Night)', category: 'chanukah', hebrewDate: '27 Kislev 5787' },
  { id: 'hs-chan4', date: '2026-12-08', label: 'Chanukah (4th Night)', category: 'chanukah', hebrewDate: '28 Kislev 5787' },
  { id: 'hs-chan5', date: '2026-12-09', label: 'Chanukah (5th Night)', category: 'chanukah', hebrewDate: '29 Kislev 5787' },
  { id: 'hs-chan6', date: '2026-12-10', label: 'Chanukah (6th Night)', category: 'chanukah', hebrewDate: '1 Tevet 5787' },
  { id: 'hs-chan7', date: '2026-12-11', label: 'Chanukah (7th Night)', category: 'chanukah', hebrewDate: '2 Tevet 5787' },
  { id: 'hs-chan8', date: '2026-12-12', label: 'Chanukah (8th Night)', category: 'chanukah', hebrewDate: '3 Tevet 5787' },
  { id: 'hs-asara', date: '2026-12-20', label: 'Asara B\'Teves', category: 'early-dismissal', hebrewDate: '10 Tevet 5787' },

  // Shvat
  { id: 'hs-tubshvat', date: '2027-01-22', label: 'Tu B\'Shvat', category: 'school-event', hebrewDate: '15 Shvat 5787' },

  // Adar
  { id: 'hs-taanit', date: '2027-03-22', label: 'Taanis Esther', category: 'early-dismissal', hebrewDate: '13 Adar 5787' },
  { id: 'hs-purim', date: '2027-03-23', label: 'Purim', category: 'no-school', hebrewDate: '14 Adar 5787' },
  { id: 'hs-shushan', date: '2027-03-24', label: 'Shushan Purim', category: 'no-school', hebrewDate: '15 Adar 5787' },

  // Nissan / Pesach
  { id: 'hs-erev-pesach', date: '2027-04-21', label: 'Erev Pesach', category: 'no-school', hebrewDate: '14 Nissan 5787' },
  { id: 'hs-pesach1', date: '2027-04-22', label: 'Pesach (1st Day)', category: 'no-school', hebrewDate: '15 Nissan 5787' },
  { id: 'hs-pesach2', date: '2027-04-23', label: 'Pesach (2nd Day)', category: 'no-school', hebrewDate: '16 Nissan 5787' },
  { id: 'hs-pesach7', date: '2027-04-28', label: 'Pesach (7th Day)', category: 'no-school', hebrewDate: '21 Nissan 5787' },
  { id: 'hs-pesach8', date: '2027-04-29', label: 'Pesach (8th Day)', category: 'no-school', hebrewDate: '22 Nissan 5787' },

  // Iyar
  { id: 'hs-yomhazik', date: '2027-05-11', label: 'Yom HaZikaron', category: 'school-event', hebrewDate: '4 Iyar 5787' },
  { id: 'hs-yomhaat', date: '2027-05-12', label: 'Yom HaAtzmaut', category: 'school-event', hebrewDate: '5 Iyar 5787' },
  { id: 'hs-lagbaomer', date: '2027-05-25', label: "Lag B'Omer", category: 'school-event', hebrewDate: '18 Iyar 5787' },

  // Sivan / Shavuot
  { id: 'hs-erev-shavuos', date: '2027-06-10', label: 'Erev Shavuos', category: 'early-dismissal', hebrewDate: '5 Sivan 5787' },
  { id: 'hs-shavuos1', date: '2027-06-11', label: 'Shavuos (1st Day)', category: 'no-school', hebrewDate: '6 Sivan 5787' },
  { id: 'hs-shavuos2', date: '2027-06-12', label: 'Shavuos (2nd Day)', category: 'no-school', hebrewDate: '7 Sivan 5787' },

  // Tammuz
  { id: 'hs-17tammuz', date: '2027-07-11', label: '17 B\'Tammuz', category: 'early-dismissal', hebrewDate: '17 Tammuz 5787' },
]

const HOLIDAY_SUGGESTIONS_5788 = [
  // Tishrei
  { id: 'hs88-rh1', date: '2027-10-01', label: 'Erev Rosh Hashana', category: 'no-school', hebrewDate: '29 Elul 5787' },
  { id: 'hs88-rh2', date: '2027-10-02', label: 'Rosh Hashana', category: 'no-school', hebrewDate: '1 Tishrei 5788' },
  { id: 'hs88-rh3', date: '2027-10-03', label: 'Rosh Hashana', category: 'no-school', hebrewDate: '2 Tishrei 5788' },
  { id: 'hs88-tzom', date: '2027-10-04', label: 'Tzom Gedalya', category: 'early-dismissal', hebrewDate: '3 Tishrei 5788' },
  { id: 'hs88-yk1', date: '2027-10-10', label: 'Erev Yom Kippur', category: 'no-school', hebrewDate: '9 Tishrei 5788' },
  { id: 'hs88-yk2', date: '2027-10-11', label: 'Yom Kippur', category: 'no-school', hebrewDate: '10 Tishrei 5788' },
  { id: 'hs88-suk1', date: '2027-10-16', label: 'Sukkos (1st Day)', category: 'no-school', hebrewDate: '15 Tishrei 5788' },
  { id: 'hs88-suk2', date: '2027-10-17', label: 'Sukkos (2nd Day)', category: 'no-school', hebrewDate: '16 Tishrei 5788' },
  { id: 'hs88-hoshana', date: '2027-10-22', label: 'Hoshana Raba', category: 'no-school', hebrewDate: '21 Tishrei 5788' },
  { id: 'hs88-smini', date: '2027-10-23', label: 'Shmini Atzeres', category: 'no-school', hebrewDate: '22 Tishrei 5788' },
  { id: 'hs88-simcha', date: '2027-10-24', label: 'Simchas Torah', category: 'no-school', hebrewDate: '23 Tishrei 5788' },

  // Kislev / Tevet
  { id: 'hs88-chan1', date: '2027-12-25', label: 'Chanukah (1st Night)', category: 'chanukah', hebrewDate: '25 Kislev 5788' },
  { id: 'hs88-chan2', date: '2027-12-26', label: 'Chanukah (2nd Night)', category: 'chanukah', hebrewDate: '26 Kislev 5788' },
  { id: 'hs88-chan3', date: '2027-12-27', label: 'Chanukah (3rd Night)', category: 'chanukah', hebrewDate: '27 Kislev 5788' },
  { id: 'hs88-chan4', date: '2027-12-28', label: 'Chanukah (4th Night)', category: 'chanukah', hebrewDate: '28 Kislev 5788' },
  { id: 'hs88-chan5', date: '2027-12-29', label: 'Chanukah (5th Night)', category: 'chanukah', hebrewDate: '29 Kislev 5788' },
  { id: 'hs88-chan6', date: '2027-12-30', label: 'Chanukah (6th Night)', category: 'chanukah', hebrewDate: '30 Kislev 5788' },
  { id: 'hs88-chan7', date: '2027-12-31', label: 'Chanukah (7th Night)', category: 'chanukah', hebrewDate: '1 Tevet 5788' },
  { id: 'hs88-chan8', date: '2028-01-01', label: 'Chanukah (8th Night)', category: 'chanukah', hebrewDate: '2 Tevet 5788' },
  { id: 'hs88-asara', date: '2028-01-09', label: "Asara B'Teves", category: 'early-dismissal', hebrewDate: '10 Tevet 5788' },

  // Shvat
  { id: 'hs88-tubshvat', date: '2028-02-12', label: "Tu B'Shvat", category: 'school-event', hebrewDate: '15 Shvat 5788' },

  // Adar
  { id: 'hs88-taanit', date: '2028-03-11', label: 'Taanis Esther', category: 'early-dismissal', hebrewDate: '13 Adar 5788' },
  { id: 'hs88-purim', date: '2028-03-12', label: 'Purim', category: 'no-school', hebrewDate: '14 Adar 5788' },
  { id: 'hs88-shushan', date: '2028-03-13', label: 'Shushan Purim', category: 'no-school', hebrewDate: '15 Adar 5788' },

  // Nissan / Pesach
  { id: 'hs88-erev-pesach', date: '2028-04-10', label: 'Erev Pesach', category: 'no-school', hebrewDate: '14 Nissan 5788' },
  { id: 'hs88-pesach1', date: '2028-04-11', label: 'Pesach (1st Day)', category: 'no-school', hebrewDate: '15 Nissan 5788' },
  { id: 'hs88-pesach2', date: '2028-04-12', label: 'Pesach (2nd Day)', category: 'no-school', hebrewDate: '16 Nissan 5788' },
  { id: 'hs88-pesach7', date: '2028-04-17', label: 'Pesach (7th Day)', category: 'no-school', hebrewDate: '21 Nissan 5788' },
  { id: 'hs88-pesach8', date: '2028-04-18', label: 'Pesach (8th Day)', category: 'no-school', hebrewDate: '22 Nissan 5788' },

  // Iyar
  { id: 'hs88-yomhazik', date: '2028-04-30', label: 'Yom HaZikaron', category: 'school-event', hebrewDate: '4 Iyar 5788' },
  { id: 'hs88-yomhaat', date: '2028-05-01', label: 'Yom HaAtzmaut', category: 'school-event', hebrewDate: '5 Iyar 5788' },
  { id: 'hs88-lagbaomer', date: '2028-05-14', label: "Lag B'Omer", category: 'school-event', hebrewDate: '18 Iyar 5788' },

  // Sivan / Shavuot
  { id: 'hs88-erev-shavuos', date: '2028-05-30', label: 'Erev Shavuos', category: 'early-dismissal', hebrewDate: '5 Sivan 5788' },
  { id: 'hs88-shavuos1', date: '2028-05-31', label: 'Shavuos (1st Day)', category: 'no-school', hebrewDate: '6 Sivan 5788' },
  { id: 'hs88-shavuos2', date: '2028-06-01', label: 'Shavuos (2nd Day)', category: 'no-school', hebrewDate: '7 Sivan 5788' },
]

/** Returns the holiday suggestions array for the given academic year string */
export function getHolidaySuggestions(academicYear) {
  if (academicYear === '2027-2028') return HOLIDAY_SUGGESTIONS_5788
  return HOLIDAY_SUGGESTIONS
}
