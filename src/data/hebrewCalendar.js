// Hardcoded Hebrew calendar data for 5787 (Aug 2026 – Jun 2027)
// Rosh Chodesh dates and major holiday suggestions

// Rosh Chodesh dates (exact Gregorian dates for 5787)
export const ROSH_CHODESH_DATES = [
  { date: '2026-08-25', month: 'Elul', enabled: true, id: 'rc-elul' },
  { date: '2026-09-23', month: 'Tishrei', enabled: true, id: 'rc-tishrei', note: 'Rosh Hashana' },
  { date: '2026-10-23', month: 'Cheshvan', enabled: true, id: 'rc-cheshvan' },
  { date: '2026-11-21', month: 'Kislev', enabled: true, id: 'rc-kislev' },
  { date: '2026-12-21', month: 'Tevet', enabled: true, id: 'rc-tevet-1' },
  { date: '2026-12-22', month: 'Tevet', enabled: true, id: 'rc-tevet-2' },
  { date: '2027-01-20', month: 'Shvat', enabled: true, id: 'rc-shvat' },
  { date: '2027-02-18', month: 'Adar', enabled: true, id: 'rc-adar' },
  { date: '2027-03-19', month: 'Nissan', enabled: true, id: 'rc-nissan-1' },
  { date: '2027-03-20', month: 'Nissan', enabled: true, id: 'rc-nissan-2' },
  { date: '2027-04-18', month: 'Iyar', enabled: true, id: 'rc-iyar' },
  { date: '2027-05-17', month: 'Sivan', enabled: true, id: 'rc-sivan' },
  { date: '2027-06-16', month: 'Tammuz', enabled: true, id: 'rc-tammuz-1' },
  { date: '2027-06-17', month: 'Tammuz', enabled: true, id: 'rc-tammuz-2' },
]

// Major holiday suggestions — shown as "suggestions" (grayed out) in Holiday Suggestions Panel
// User clicks "Add to calendar" to activate them
export const HOLIDAY_SUGGESTIONS = [
  // Tishrei Holidays
  { id: 'hs-rh1', date: '2026-09-11', label: 'Erev Rosh Hashana', category: 'no-school', hebrewDate: '29 Elul 5786' },
  { id: 'hs-rh2', date: '2026-09-12', label: 'Rosh Hashana', category: 'no-school', hebrewDate: '1 Tishrei 5787' },
  { id: 'hs-rh3', date: '2026-09-13', label: 'Rosh Hashana', category: 'no-school', hebrewDate: '2 Tishrei 5787' },
  { id: 'hs-tzom', date: '2026-09-14', label: 'Tzom Gedalya', category: 'early-130', hebrewDate: '3 Tishrei 5787' },
  { id: 'hs-yk1', date: '2026-09-20', label: 'Erev Yom Kippur', category: 'no-school', hebrewDate: '9 Tishrei 5787' },
  { id: 'hs-yk2', date: '2026-09-21', label: 'Yom Kippur', category: 'no-school', hebrewDate: '10 Tishrei 5787' },
  { id: 'hs-suk1', date: '2026-09-25', label: 'Sukkos (1st Day)', category: 'no-school', hebrewDate: '15 Tishrei 5787' },
  { id: 'hs-suk2', date: '2026-09-26', label: 'Sukkos (2nd Day)', category: 'no-school', hebrewDate: '16 Tishrei 5787' },
  { id: 'hs-hoshana', date: '2026-10-02', label: 'Hoshana Raba', category: 'no-school', hebrewDate: '21 Tishrei 5787' },
  { id: 'hs-smini', date: '2026-10-03', label: 'Shmini Atzeres', category: 'no-school', hebrewDate: '22 Tishrei 5787' },
  { id: 'hs-simcha', date: '2026-10-04', label: 'Simchas Torah', category: 'no-school', hebrewDate: '23 Tishrei 5787' },

  // Kislev / Tevet
  { id: 'hs-chan1', date: '2026-12-01', label: 'Chanukah (1st Night)', category: 'chanukah', hebrewDate: '25 Kislev 5787' },
  { id: 'hs-chan2', date: '2026-12-02', label: 'Chanukah (2nd Night)', category: 'chanukah', hebrewDate: '26 Kislev 5787' },
  { id: 'hs-chan3', date: '2026-12-03', label: 'Chanukah (3rd Night)', category: 'chanukah', hebrewDate: '27 Kislev 5787' },
  { id: 'hs-chan4', date: '2026-12-04', label: 'Chanukah (4th Night)', category: 'chanukah', hebrewDate: '28 Kislev 5787' },
  { id: 'hs-chan5', date: '2026-12-05', label: 'Chanukah (5th Night)', category: 'chanukah', hebrewDate: '29 Kislev 5787' },
  { id: 'hs-chan6', date: '2026-12-06', label: 'Chanukah (6th Night)', category: 'chanukah', hebrewDate: '1 Tevet 5787' },
  { id: 'hs-chan7', date: '2026-12-07', label: 'Chanukah (7th Night)', category: 'chanukah', hebrewDate: '2 Tevet 5787' },
  { id: 'hs-chan8', date: '2026-12-08', label: 'Chanukah (8th Night)', category: 'chanukah', hebrewDate: '3 Tevet 5787' },
  { id: 'hs-asara', date: '2026-12-20', label: 'Asara B\'Teves', category: 'early-130', hebrewDate: '10 Tevet 5787' },

  // Shvat
  { id: 'hs-tubshvat', date: '2027-02-01', label: 'Tu B\'Shvat', category: 'school-event', hebrewDate: '15 Shvat 5787' },

  // Adar
  { id: 'hs-taanit', date: '2027-03-22', label: 'Taanis Esther', category: 'early-130', hebrewDate: '13 Adar 5787' },
  { id: 'hs-purim', date: '2027-03-23', label: 'Purim', category: 'no-school', hebrewDate: '14 Adar 5787' },
  { id: 'hs-shushan', date: '2027-03-24', label: 'Shushan Purim', category: 'no-school', hebrewDate: '15 Adar 5787' },

  // Nissan / Pesach
  { id: 'hs-erev-pesach', date: '2027-04-15', label: 'Erev Pesach', category: 'no-school', hebrewDate: '14 Nissan 5787' },
  { id: 'hs-pesach1', date: '2027-04-16', label: 'Pesach (1st Day)', category: 'no-school', hebrewDate: '15 Nissan 5787' },
  { id: 'hs-pesach2', date: '2027-04-17', label: 'Pesach (2nd Day)', category: 'no-school', hebrewDate: '16 Nissan 5787' },
  { id: 'hs-pesach7', date: '2027-04-22', label: 'Pesach (7th Day)', category: 'no-school', hebrewDate: '21 Nissan 5787' },
  { id: 'hs-pesach8', date: '2027-04-23', label: 'Pesach (8th Day)', category: 'no-school', hebrewDate: '22 Nissan 5787' },

  // Iyar
  { id: 'hs-yomhazik', date: '2027-04-29', label: 'Yom HaZikaron', category: 'school-event', hebrewDate: '11 Iyar 5787' },
  { id: 'hs-yomhaat', date: '2027-04-30', label: 'Yom HaAtzmaut', category: 'school-event', hebrewDate: '12 Iyar 5787' },
  { id: 'hs-lagbaomer', date: '2027-05-06', label: "Lag B'Omer", category: 'school-event', hebrewDate: '18 Iyar 5787' },

  // Sivan / Shavuot
  { id: 'hs-erev-shavuos', date: '2027-06-10', label: 'Erev Shavuos', category: 'early-1130', hebrewDate: '5 Sivan 5787' },
  { id: 'hs-shavuos1', date: '2027-06-11', label: 'Shavuos (1st Day)', category: 'no-school', hebrewDate: '6 Sivan 5787' },
  { id: 'hs-shavuos2', date: '2027-06-12', label: 'Shavuos (2nd Day)', category: 'no-school', hebrewDate: '7 Sivan 5787' },

  // Tammuz
  { id: 'hs-17tammuz', date: '2027-07-11', label: '17 B\'Tammuz', category: 'early-130', hebrewDate: '17 Tammuz 5787' },
]
