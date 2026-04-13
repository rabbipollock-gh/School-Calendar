# Changelog

All notable changes to the School Calendar Builder are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [1.2.0] — 2026-04-12
### Added
- **6 new PDF templates** — Parchment Scroll (portrait, ketubah-style), Dual Heritage (Hebrew-dominant headers), Regal Triptych (3-column by zman term), Photo Showcase (school photo banner), Hebrew Date Focus (Hebrew date in every cell), Elegant Feminine (plum & champagne, girls' schools)
- **HEBREW_MONTH_START_MAP** — Hebrew date lookup data for 5787 and 5788 academic years, enabling Hebrew day numbers in every calendar cell
- **`getHebrewDayNumber(dateKey)`** — utility function for computing the Hebrew day number for any Gregorian date
- **Banner image field** — new `schoolInfo.bannerImage` (upload in Settings → Logo) used by Photo Showcase template
- **Version number displayed** — `v1.2.0` shown in Diagnostics modal system info and Settings footer
- **Diagnostics: app version** — `App version` row added to system info section

### Changed
- **Export menu audit** — PPTX removed from main export menu; Print demoted to a subtle secondary option at the bottom

---

## [1.1.0] — 2026-04-12
### Added
- **Cloud sync** — calendar data saved to Supabase, accessible from any device
- **Authentication** — email/password login and registration (Supabase Auth)
- **OnboardingWizard** — 6-step school setup flow after first registration (address, phone, fax, email, website, hours, other info, academic year)
- **Logout button** — account avatar in Header with email initial and logout dropdown
- **PDF sidebar drag-and-drop block manager** — reorder/hide School Hours, Event Legend, Other Information, and Contact Info blocks in Settings
- **Email + website fields** — added to school info (Settings drawer and OnboardingWizard)
- **Diagnostics panel** — in-app rolling error/warn log with userId, school code, cloud sync timestamp, and copy-all button (Settings → Diagnostics)
- **Hebrew calendar data for 5788** (2027–2028) — `getHolidayMap()` and `getRoshChodeshMap()` now support both 5787 and 5788
- **Logo shape picker** — circle, rounded square, or square crop in PDF exports (Settings → Logo)
- **Start New Academic Year button** — advances year, clears events, keeps school info and categories (Settings → Backup & Restore)
- **Other Information field** — freeform text field for additional school info printed in Classic PDF sidebar
- **Dark Elegant + Bulletin Board sidebars** — now include full contact info (address, phone, fax, email, website) below the legend

### Fixed
- Cloud sync: empty local state no longer overwrites valid cloud data on first load
- OnboardingWizard: data now correctly saves to school info on finish or skip
- SchoolCodeGate: no longer shows school-name prompt for authenticated users
- Non-YAYOE schools start with blank school info instead of YAYOE defaults

---

## [1.0.0] — 2026-01-01
### Initial Release
- React + Vite SPA with Tailwind CSS
- 6 PDF export styles: Classic, Minimal, Portrait Monthly, Year at a Glance, Dark Elegant, Bulletin Board
- localStorage-only data storage, keyed by school code
- YAYOE pre-loaded events and school info (`#yayoe` URL bypass)
- Event categories with colors and icons
- Theme system (10 themes with primary/accent/shabbat colors)
- Jewish holiday suggestions panel with 5787 data
- Conflict detection panel
- Search modal (Cmd+K)
- School code gate
- Export formats: PPTX, ICS (all events / no-school only), CSV, JSON backup
- Import CSV
- Share / collaboration URL (compressed state in `?cal=` param)
- Undo/redo support
- Dark mode support
