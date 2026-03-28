import { nanoid } from '../utils/nanoid.js'

// Pre-loaded school events for Yeshiva Aharon Yaakov Ohr Eliyahu
// Academic Year 2026–2027
export const DEFAULT_EVENTS = {
  // ── AUGUST 2026 ──────────────────────────────────────
  '2026-08-19': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'New Staff In-Service' },
  ],
  '2026-08-20': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'All Staff In-Service' },
  ],
  '2026-08-21': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'All Staff In-Service' },
  ],
  '2026-08-24': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'All Staff In-Service' },
  ],
  '2026-08-25': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'All Staff In-Service' },
  ],
  '2026-08-26': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: 'First Day Yesod–8' },
  ],
  '2026-08-27': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-1130', label: 'Preschool Half Day' },
  ],
  '2026-08-28': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: 'Preschool First Full Day' },
  ],

  // ── SEPTEMBER 2026 ───────────────────────────────────
  '2026-09-02': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: 'Y-B Back to School Night' },
  ],
  '2026-09-08': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: '6-8 Back to School Night' },
  ],
  '2026-09-11': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Erev Rosh Hashana' },
  ],
  '2026-09-14': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-130', label: 'Tzom Gedalya / 9AM Start', time: '09:00' },
  ],
  '2026-09-20': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Yom Kippur' },
  ],
  '2026-09-21': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Yom Kippur' },
  ],
  '2026-09-22': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: '9 AM Late Start', time: '09:00' },
  ],
  '2026-09-23': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-09-24': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-09-25': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-09-26': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-09-27': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-09-28': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-09-29': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-09-30': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],

  // ── OCTOBER 2026 ─────────────────────────────────────
  '2026-10-01': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-10-02': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-10-03': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-10-04': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-10-05': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Sukkos Break' },
  ],
  '2026-10-06': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: 'School Resumes' },
  ],
  '2026-10-23': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Cheshvan' },
  ],

  // ── NOVEMBER 2026 ────────────────────────────────────
  '2026-11-15': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'PTC' },
  ],
  '2026-11-16': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'In-Service' },
  ],
  '2026-11-23': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Kislev' },
  ],
  '2026-11-26': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-1200', label: 'Thanksgiving Hebrew Only' },
  ],
  '2026-11-27': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-1130', label: 'Thanksgiving Hebrew Only' },
  ],

  // ── DECEMBER 2026 ────────────────────────────────────
  '2026-12-04': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Chanukah' },
  ],
  '2026-12-05': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Chanukah' },
  ],
  '2026-12-06': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Chanukah' },
  ],
  '2026-12-07': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Chanukah' },
  ],
  '2026-12-08': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'chanukah', label: 'Chanukah Dismissal', time: '15:45' },
  ],
  '2026-12-09': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'chanukah', label: 'Chanukah Dismissal', time: '15:45' },
  ],
  '2026-12-10': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'chanukah', label: 'Chanukah Dismissal', time: '15:45' },
  ],
  '2026-12-20': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-130', label: 'Asara B\'Teves' },
  ],
  '2026-12-21': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Tevet' },
  ],
  '2026-12-22': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Tevet' },
  ],

  // ── JANUARY 2027 ─────────────────────────────────────
  '2027-01-01': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-1130', label: "New Year's Hebrew Only" },
  ],
  '2027-01-20': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Shvat' },
  ],
  '2027-01-22': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-23': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-24': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-25': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-26': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-27': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-28': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-29': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-30': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],
  '2027-01-31': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Winter Break' },
  ],

  // ── FEBRUARY 2027 ────────────────────────────────────
  '2027-02-01': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: 'School Resumes' },
  ],
  '2027-02-14': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'PTC' },
  ],
  '2027-02-15': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'PD In-Service' },
  ],
  '2027-02-18': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Adar' },
  ],

  // ── MARCH 2027 ───────────────────────────────────────
  '2027-03-19': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Nissan' },
  ],
  '2027-03-22': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-130', label: 'Taanis Esther' },
  ],
  '2027-03-23': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Purim' },
  ],
  '2027-03-24': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Shushan Purim' },
  ],

  // ── APRIL 2027 ───────────────────────────────────────
  '2027-04-16': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-17': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-18': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-19': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-20': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-21': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-22': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-23': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-24': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-25': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-26': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-27': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-28': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-29': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-04-30': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],

  // ── MAY 2027 ─────────────────────────────────────────
  '2027-05-01': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-05-02': [{ id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Pesach Break' }],
  '2027-05-03': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: 'School Resumes' },
  ],
  '2027-05-17': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Sivan' },
  ],

  // ── JUNE 2027 ────────────────────────────────────────
  '2027-06-10': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'early-1130', label: 'Erev Shavuos Boys' },
  ],
  '2027-06-11': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Shavuos' },
  ],
  '2027-06-12': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Shavuos' },
  ],
  '2027-06-13': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'no-school', label: 'Graduation' },
  ],
  '2027-06-15': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'school-event', label: 'Last Day 3:45 Dismissal', time: '15:45' },
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Tammuz' },
  ],
  '2027-06-16': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'rosh-chodesh', label: 'Rosh Chodesh Tammuz' },
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'In-Service' },
  ],
  '2027-06-17': [
    { id: 'ev-' + Math.random().toString(36).slice(2), category: 'staff', label: 'In-Service' },
  ],
}
