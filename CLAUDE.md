# CLAUDE.md — School Calendar Builder

## Project Overview

A React + Vite single-page application for building and exporting Jewish school academic calendars. Built for Yeshiva Aharon Yaakov Ohr Eliyahu (YAYOE) but designed to be multi-school via school codes.

## Tech Stack

- **React 19** with hooks and context
- **Vite 8** (build tool)
- **Tailwind CSS 4** (utility classes)
- **jsPDF 4** — PDF generation (all 6 styles)
- **pdf.js (CDN, v3.11.174)** — PDF canvas preview (cross-browser, including Safari)
- **pptxgenjs** — PowerPoint export
- **lz-string** — URL compression for share links
- **ics** — iCalendar export

## Key Architecture

### State Management
All calendar state lives in `src/context/CalendarContext.jsx` via `useReducer`. Persisted to `localStorage` keyed by school code (`yayoe-calendar-v1-{schoolCode}`). Access state via `useCalendar()` hook.

Context exposes:
- `state` — events, categories, schoolInfo, settings
- `dispatch` — reducer actions
- `readOnly` — true when shared view (not unlocked) or locked
- `academicMonths` — memoized array of `{year, month}` objects for the academic year (Aug–Jun), recomputed when `settings.academicYear` changes
- `canUndo`, `canRedo`, `collabUnlocked`, `setCollabUnlocked`

### Academic Year
- Stored as `settings.academicYear` (e.g. `"2026-2027"`)
- `src/utils/academicMonths.js` — shared utility `getAcademicMonths(academicYear)` returns 11 months (Aug–Jun)
- All components must get months from `useCalendar().academicMonths` — **never import from useKeyboardNav.js**
- Hebrew year stored in `settings.hebrewYear` (e.g. `"5787"`)

### Events
- Stored as `{ [dateKey: string]: Event[] }` where dateKey is `"YYYY-MM-DD"`
- Each event: `{ id, category, label, time?, color?, banner? }`
- Categories: `{ id, name, color, icon, visible, deletable }`

### PDF Export (`src/utils/exportPDF.js`)
6 styles, all return data URI string (preview) or trigger download:
1. **classic** — 4-col landscape, sidebar, inline notes strip
2. **minimal** — landscape, white bg, no sidebar, events strip at bottom
3. **portrait-monthly** — one month per page, portrait A4
4. **year-at-a-glance** — all 11 months tiny on one page (5×2 grid)
5. **dark-elegant** — dark navy bg, theme accent headers
6. **bulletin-board** — theme-colored header, colorful rotating palette for month headers

All styles use `getTheme(settings.theme, customPrimary, customAccent)` for colors, and draw logo via `circularCropImage()`.

### Themes
Defined in `src/utils/themeUtils.js` → `THEME_MAP`. Each theme has `primary`, `accent`, `shabbatBg`, `headerSubText`, etc. Applied as CSS custom properties (`--color-primary`, `--color-accent`, etc.).

### School Code Gate
`src/utils/schoolCode.js` — reads `?code=` URL param. `src/components/SchoolCodeGate.jsx` — blocks access without a valid code. YAYOE gets pre-loaded events; all other schools start blank.

### Share / Collab
`src/utils/shareUrl.js` — compresses full state into URL. `src/components/CollabModal.jsx` — password-based collaboration with "adopt & save" feature.

## File Map

```
src/
  App.jsx                    — root, modal state, keyboard nav wiring
  context/
    CalendarContext.jsx      — all state, reducer, academicMonths memoization
  components/
    Header.jsx               — top bar, export menu, share, lock, undo/redo
    CalendarGrid.jsx         — desktop 4-col grid + mobile swipe view
    MonthBlock.jsx           — single month calendar block
    DayCell.jsx              — individual day cell, tooltip
    Sidebar.jsx              — school branding, legend, quick actions
    MonthEventsPanel.jsx     — bottom events panel (eventsPanel === 'bottom')
    EventModal.jsx           — add/edit/delete events, inline range add
    BulkRangeModal.jsx       — add event across a date range
    SettingsDrawer.jsx       — all settings (school info, year, theme, backup)
    PDFPreviewModal.jsx      — PDF style picker + canvas preview (pdf.js)
    TemplateSelector.jsx     — calendar view template (classic/minimal/compact)
    CategoryManager.jsx      — manage event categories
    SearchModal.jsx          — search events (Cmd+K)
    HolidaySuggestionsPanel  — Jewish holiday suggestions
    ConflictPanel.jsx        — event conflict warnings
    CollabModal.jsx          — collaboration / share link
    SchoolCodeGate.jsx       — school code authentication
  utils/
    academicMonths.js        — getAcademicMonths(academicYear) shared utility
    exportPDF.js             — all 6 PDF styles
    exportPPTX.js            — PowerPoint export
    exportICS.js             — iCalendar export
    exportCSV.js             — CSV export
    importCSV.js             — CSV import
    themeUtils.js            — THEME_MAP, getTheme(), applyThemeToCss()
    dateUtils.js             — date helpers
    shareUrl.js              — URL compression/decompression
    schoolCode.js            — school code from URL
    searchIndex.js           — event search indexing
    printStyles.js           — browser print trigger
    pdfFonts.js              — Montserrat font loader for jsPDF
  hooks/
    useKeyboardNav.js        — arrow key navigation (academicYear param)
  data/
    defaultCategories.js     — built-in categories (no-school, holiday, etc.)
    defaultEvents.js         — YAYOE pre-loaded events + empty default
    hebrewCalendar.js        — ROSH_CHODESH_MAP dates
    hebrewMonthNames.js      — getHebrewMonthLabel(year, month)
```

## Development

```bash
npm run dev      # start dev server (Vite, hot reload)
npm run build    # production build → dist/
npm run preview  # preview production build
```

## Important Patterns

- **Never hardcode years.** All month arrays must come from `getAcademicMonths(academicYear)` or `useCalendar().academicMonths`.
- **PDF preview uses canvas** (pdf.js CDN), not `<iframe>` or `<object>` — required for Safari compatibility.
- **PDF preview returns data URI** (`doc.output('datauristring')`), download returns saved file.
- **readOnly** must be checked before any dispatch that modifies state.
- **School-specific storage**: localStorage key includes school code — changing school code creates a fresh calendar.
- **circularCropImage()** in exportPDF.js crops any logo to a circle before embedding in PDFs.

## Deployment

Pushed to GitHub: `https://github.com/rabbipollock-gh/School-Calendar.git` (branch: `main`). Auto-deploys on push.
