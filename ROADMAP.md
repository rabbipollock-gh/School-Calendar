# School Calendar Builder — Master Plan

## Current Version: 1.2.0

See **Version History** section for what each version added.

---

## Architecture

```
calendar.yayoe.org
       │
       ▼
  React SPA (GitHub Pages)
       │
       ├──► Supabase Auth  (email + password login)
       ├──► Supabase DB    (calendar data, subscription status, logs)
       └──► Stripe         (payment checkout + webhooks)
                │
                └──► Supabase Edge Function (webhook handler)
```

---

## ✅ DONE

### v1.0.0 — Initial Release (baseline)
- React + Vite SPA, Tailwind CSS, jsPDF
- 6 PDF export styles (Classic, Minimal, Portrait Monthly, Year at a Glance, Dark Elegant, Bulletin Board)
- localStorage-only storage, YAYOE pre-loaded events
- Categories, themes, holiday suggestions, conflict panel
- PPTX, ICS, CSV, JSON backup exports
- School code gate (`#yayoe` bypass)

### v1.1.0 — Cloud & Auth
- **Phase 1** — Supabase project, `profiles` + `calendars` tables, RLS, GitHub Actions env secrets
- **Phase 2** — Email/password auth, AuthGate (login/register), OnboardingWizard (6 steps), logout dropdown in Header, post-registration success screen
- **Phase 3** — Cloud sync: load on login, debounced 2s save, "newer version" prompt, empty-state guard
- **Phase 5a** — Start New Academic Year button
- **Phase 5b** — Logo shape picker (circle / rounded / square) in SettingsDrawer + PDF exports
- **Phase 5c** — Hebrew calendar data for 5788 (2027–2028); `getHolidayMap()` / `getRoshChodeshMap()` functions
- **Phase 5d** — `otherInfo` field in Classic PDF sidebar; PDF sidebar drag-and-drop block manager (School Hours / Legend / Other Info / Contact reorderable + hideable); email + website fields added to school info and OnboardingWizard
- **Phase 5e** — In-app diagnostics panel: rolling 50-entry error/warn log, userId + school code + cloud sync status, copy-all button

### v1.2.0 — Templates, Logging & Versioning ✅ SHIPPED (2026-04-13)

#### Phase 10 — Version Numbering
- `src/version.js` — single source of truth (`APP_VERSION = '1.2.0'`)
- `CHANGELOG.md` — Keep a Changelog format, full history
- `DiagnosticsModal` — shows `v{APP_VERSION}` in system info section
- `SettingsDrawer` — shows `v{APP_VERSION}` in footer

#### Phase 9 — Structured Logging (in-app portion complete)
- `src/utils/logger.js` — `logger.debug/info/warn/error(category, msg, metadata)` API
- Logs buffered in memory (max 100), include `app_version` per entry
- Mirrors warn/error to `errorLog.js` → DiagnosticsModal reads both
- `logger.flush()` stub ready for future Supabase log-ingest Edge Function
- `errorLog.js` — added `_pushToLog()` export for logger bridge
- `CalendarContext.jsx` — all `console.log` cloud sync calls replaced with `logger.debug/info/error('sync', ...)`
- `supabaseSync.js` — all `console.log/error` replaced with `logger.*` calls

#### Phase 8 — Six New PDF Templates
All 6 new templates implemented and dispatched in `exportPDF.js`. PDFPreviewModal updated with All/Yearly/Monthly filter tabs.

| Style ID | Name | Layout | Type |
|----------|------|--------|------|
| `parchment-scroll` | Parchment Scroll | Portrait A4, 11 pages | Monthly |
| `dual-heritage` | Dual Heritage | Landscape, single page | Yearly |
| `regal-triptych` | Regal Triptych | Landscape, 3-column | Yearly |
| `photo-showcase` | Photo Showcase | Landscape A4, 11 pages | Monthly |
| `hebrew-date-focus` | Every Day in Hebrew | Landscape, single page | Yearly |
| `elegant-feminine` | Orchid Elegance | Portrait A4, 11 pages | Monthly |

Key implementation notes:
- `cropLogoImage` fixed: white canvas fill before clip (was causing black box on transparent logos)
- `drawDecorativeDiamondBand` uses `doc.line()` + `doc.circle()` (jsPDF 4 has no `doc.lines()`)
- `drawPageBorder` uses `doc.rect()` + `doc.line()` corner marks
- Photo Showcase: `doc.saveGraphicsState()` removed (doesn't exist in jsPDF 4)
- Portrait multi-page templates use `for` loops not `forEach` (async/await compatibility)
- `HEBREW_MONTH_START_MAP` + `getHebrewDayNumber()` added to `hebrewCalendar.js`
- Banner photo upload in SettingsDrawer with 4.9:1 aspect ratio placeholder + size guidance

#### Phase 7 — Export Format Audit
- PPTX removed from Header export menu
- Print demoted to small gray secondary link

#### Settings Persistence Fixes
- `DEFAULT_SETTINGS` now includes `logoShape`, `customPrimary`, `customAccent`
- `DEFAULT_SCHOOL_INFO` now includes `bannerImage`
- Deep-merge on hydration: `{ ...DEFAULT_SETTINGS, ...stored.settings }` (prevents field loss on upgrade)
- Same deep-merge in `acceptCloudVersion()`
- `saveToStorage` catches `QuotaExceededError` and saves without logo/banner as fallback
- `hebrewEventToggles` now included in cloud save payload

---

## 🔜 TO DO — ordered by priority

### Phase 13 — PDF Design Polish Pass ⬅️ DOING FIRST
> Target version bump: **1.2.1** (patch, visual-only)

#### Context
All 12 PDF templates are functional but not yet design-worthy. The user is reviewing each template via Claude (external AI session), receiving specific design critique and suggestions, then bringing those prompts into this conversation for implementation. This phase is iterative — one template at a time, not a single batch.

#### Workflow
1. User exports a PDF template and reviews it externally (Claude Co-Work or similar)
2. User receives design suggestions (typography, spacing, color, layout improvements)
3. User pastes the suggestions into this conversation
4. Implementation is done in `src/utils/exportPDF.js` for the relevant template function

#### All 12 Templates to Cover

| # | Style ID | Function in exportPDF.js | Type |
|---|---|---|---|
| 1 | `classic` | `exportClassic` | Yearly landscape |
| 2 | `minimal` | `exportMinimal` | Yearly landscape |
| 3 | `portrait-monthly` | `exportMonthlyPortrait` | Monthly portrait |
| 4 | `year-at-a-glance` | `exportYearAtAGlance` | Yearly single page |
| 5 | `dark-elegant` | `exportDarkElegant` | Yearly landscape |
| 6 | `bulletin-board` | `exportBulletinBoard` | Yearly landscape |
| 7 | `parchment-scroll` | `exportParchmentScroll` | Monthly portrait |
| 8 | `dual-heritage` | `exportDualHeritage` | Yearly landscape |
| 9 | `regal-triptych` | `exportRegalTriptych` | Yearly landscape |
| 10 | `photo-showcase` | `exportPhotoShowcase` | Monthly portrait |
| 11 | `hebrew-date-focus` | `exportHebrewDateFocus` | Yearly single page |
| 12 | `elegant-feminine` | `exportElegantFeminine` | Monthly portrait |

#### Tracking Progress
- [ ] classic
- [ ] minimal
- [ ] portrait-monthly
- [x] year-at-a-glance
- [ ] dark-elegant
- [ ] bulletin-board
- [ ] parchment-scroll
- [ ] dual-heritage
- [ ] regal-triptych
- [ ] photo-showcase
- [ ] hebrew-date-focus
- [ ] elegant-feminine

#### Notes
- Changes are visual-only — no new data, no new PDF styles, no behavior changes
- Each redesign verified by re-generating and reviewing in VS Code (vscode-pdf) or browser
- `src/utils/exportPDF.js` is the only file that should change

---

### Phase 11 — Dismissal Time & No-School Display in Monthly PDFs
> Target version bump: **1.2.2** (patch)

#### Context
Events have a `time` field (HH:MM 24-hour string, e.g. `"13:30"`) that is stored and editable in the UI but **never rendered in any PDF template**. The user wants the 4 monthly PDF templates to show dismissal time when it's set, and to clearly surface no-school days.

#### What to Build
In all 4 monthly templates, make two changes inside the event-drawing forEach loop:

1. **Time display** — If `ev.time` is set, show a formatted time string (e.g. `"1:30pm"`) as a small secondary line inside the colored event box, beneath the label.
2. **Dynamic box height** — Expand the event box height by ~3mm when a time is present, then use a running `evY` accumulator (replacing the fixed `ei * SPACING` math) so subsequent events shift down correctly.

No-school events already show their label ("No School") — no special handling needed.

#### Implementation

**File**: `src/utils/exportPDF.js` only.

**Step 1 — Add `formatTime()` helper** near the top of the file (after the imports):
```js
function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${ampm}` : `${hour}:${String(m).padStart(2,'0')}${ampm}`
}
```

**Step 2 — Update the event-rendering loop in each of the 4 monthly templates:**

Replace the fixed `ei * SPACING` pattern with a running `evY` accumulator, and add time rendering. Apply to these 4 functions:

| Template function | Approx lines | Current box H | Time box H | Label font | Time font |
|---|---|---|---|---|---|
| `exportParchmentScroll` | ~1404–1418 | 3.5mm | +3mm → 6.5mm | 3.2pt | 2.5pt |
| `exportMonthlyPortrait` | ~908–915 | 6mm | +3mm → 9mm | 5pt bold | 3.5pt |
| `exportPhotoShowcase` | ~1854–1863 | 4mm | +3mm → 7mm | 3.5pt | 2.5pt |
| `exportElegantFeminine` | ~2153–2162 | 3.8mm | +3mm → 6.8mm | 3pt | 2.5pt |

Pattern for each (replace existing forEach):
```js
// Replace fixed-offset loop with accumulating evY
let evY = cy + EXISTING_OFFSET  // same starting Y as before
;(events[dateKey] || []).slice(0, MAX_EVENTS).forEach((ev) => {
  const hasTime = !!ev.time
  const boxH = hasTime ? BASE_H + 3 : BASE_H
  const [er, eg, eb] = hexToRgbLocal(ev.color || '#888')
  doc.setFillColor(er, eg, eb)
  doc.rect(cx + X_PAD, evY, cellW - X_PAD * 2, boxH, 'F')  // existing rect shape
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(LABEL_FONT)
  doc.setFont('helvetica', 'normal')
  doc.text(ev.label, cx + TEXT_X, evY + LABEL_Y_WITHIN_BOX, { maxWidth: cellW - TEXT_MARGIN })
  if (hasTime) {
    doc.setFontSize(2.5)
    doc.text(formatTime(ev.time), cx + TEXT_X, evY + LABEL_Y_WITHIN_BOX + 2.8, { maxWidth: cellW - TEXT_MARGIN })
  }
  evY += boxH + GAP  // GAP = current spacing - BASE_H (the gap between boxes)
})
```

Each template has slightly different X_PAD, TEXT_X, TEXT_MARGIN, LABEL_Y_WITHIN_BOX, and GAP values — preserve those exact values from the existing code, only replacing the `ei * SPACING` calculation.

#### Verification
1. Run Node.js test: add an event with `time: '13:30'` and one without, run all 4 monthly templates, confirm PDF text contains `"1:30pm"` in the time-bearing template
2. Manually open PDFs in VS Code (vscode-pdf) to visually confirm time line appears beneath the event label
3. Verify multiple events per day still stack correctly (no overlap)
4. Confirm no-school events display normally (no time field = no change)

---

### Phase 9 Full — Supabase Log Persistence
> Target version bump: **1.2.2** (patch, infrastructure-only)

The in-app logger (`src/utils/logger.js`) is complete. `logger.flush()` is a stub. To complete:

| File | Change |
|------|--------|
| `supabase/functions/log-ingest/index.ts` | NEW — Edge Function: receives log batch, writes to `app_logs` table |
| `src/utils/logger.js` | Wire `flush()` to POST to `/functions/v1/log-ingest` |
| `src/context/CalendarContext.jsx` | Call `logger.flush()` after cloud save + auth events |
| Supabase SQL | Create `app_logs` table (see schema below) |

```sql
create table app_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  school_code text,
  level       text not null,  -- 'debug' | 'info' | 'warn' | 'error'
  category    text,           -- 'auth' | 'sync' | 'pdf' | 'ui' | 'general'
  message     text not null,
  metadata    jsonb,
  app_version text,
  created_at  timestamptz default now()
);
-- RLS: users can insert their own logs; admins can read all
```

---

### Phase 12 — Multi-Calendar Management
> Target version bump: **1.2.3** (minor, frontend-only)

#### Context
Users need multiple calendars — different divisions, test calendars, etc. Currently one calendar per URL hash. This adds a metadata index + manager UI, purely additive.

#### What to Build

**New file: `src/utils/calendarManager.js`**
Index stored at `yayoe-calendar-index-v1` in localStorage.
Entry shape: `{ id, name, createdAt, updatedAt, academicYear }`
Functions: `getCalendarIndex`, `upsertCalendarEntry`, `adoptExistingCalendarIfNeeded`, `createCalendar` (slug+collision guard), `duplicateCalendar` (copy localStorage data + update `schoolInfo.name`), `deleteCalendar`, `getStorageKeyForId`
Imports `slugify` from `./schoolCode.js`.

**New file: `src/components/CalendarManagerModal.jsx`**
Lists all calendars with name, academic year, active indicator.
Actions per row: Switch, Duplicate (inline name input), Delete (inline confirmation).
Create new calendar: name input → `createCalendar` → `handleSwitch(id)`.
Switch = `window.location.hash = id` + `window.location.reload()`.
Delete-active guard: if deleting current, auto-switch to `updated[0]` after delete.
Fallback: if index empty on open, show synthetic entry from `state.schoolInfo.name`.

**Modify `src/context/CalendarContext.jsx`**
1. `saveToStorage` — append `upsertCalendarEntry(id, { name, academicYear })` after localStorage write.
2. New one-time `useEffect` (empty deps) — calls `adoptExistingCalendarIfNeeded` to register existing users' calendar into the index on first load. Skip if `sharedState`.

**Modify `src/components/Header.jsx`**
Add `onOpenCalendarManager` prop. Add 📚 Calendars button before Settings button, hidden when shared view.

**Modify `src/App.jsx`**
Add `calendarManagerOpen` state, pass prop to Header, render `<CalendarManagerModal>`.

#### Edge Cases
- Creating a name whose slug already exists → append `-2`, `-3` until unique
- Empty slug (all special chars) → throw "Invalid calendar name"
- Deleting the only calendar → block with "Cannot delete the only calendar"
- Duplicating when source key missing → throw "Source calendar not found"
- Existing single-calendar users → `adoptExistingCalendarIfNeeded` runs once, creates index entry, nothing changes for them

#### Verification
1. Existing user opens app → localStorage gains `yayoe-calendar-index-v1` with 1 entry
2. Open Calendars modal → existing calendar listed as active
3. Create new → blank calendar loads at new hash
4. Duplicate active → copy opens with cloned events
5. Switch back → both calendars independent
6. Delete non-active → removed from list, no reload
7. Delete active → switches to next calendar, old data purged
8. Shared view (`?cal=`) → Calendars button not shown

---

### Infrastructure — Private GitHub Repo
> No version bump (infrastructure-only)

Currently the GitHub repo is public. To keep source code private while keeping the site publicly accessible:

1. Migrate deployment from GitHub Pages to **Netlify** or **Cloudflare Pages** (both free tier)
   - Connect the service to the GitHub repo (OAuth authorization)
   - Set build command: `npm run build`, publish directory: `dist`
   - Confirm auto-deploy on push still works
2. Set the GitHub repo to **Private** in repository Settings
3. Update `CLAUDE.md` deployment section with new deploy URL/service

> Note: GitHub Pages free tier requires a public repo. Netlify/Cloudflare Pages work with private repos at no cost.

---

### Phase 4 — Stripe Payments
> Target version bump: **1.3.0** (or **2.0.0** — confirm at implementation time)

- Free tier: up to 5 events
- $99/yr subscription per school
- Stripe Checkout + Supabase Edge Function webhook
- Paywall nudge in `EventModal.jsx` + `BulkRangeModal.jsx`
- YAYOE always bypasses

**Files**: `src/components/PaywallScreen.jsx` (NEW), `src/utils/stripe.js` (NEW), `supabase/functions/stripe-webhook/index.ts` (NEW)

> ⚠️ Adding a paid subscription model may warrant **2.0.0** rather than 1.x. Confirm with user before tagging.

---

### Phase 6 — Calendar Subscriptions & Parent Notifications
> Target version bump: **1.4.0**

- Live ICS feed URL via Supabase Edge Function (`ical-feed`)
- Subscribe modal with Google / Apple / Outlook instructions
- `subscribers` Supabase table (school_code + email)
- Email notification digest when school saves changes (rate-limited 1/day)
- Requires email service (Resend recommended — free tier 3k/month)

---

## Version History

| Version | Date | Summary |
|---------|------|---------|
| **1.2.0** | 2026-04-13 | 6 new PDF templates, structured logging, version wiring, settings persistence fixes, export audit |
| **1.1.0** | 2026-04-01 | Cloud sync + Auth + PDF improvements + Diagnostics |
| **1.0.0** | Baseline | Original localStorage app, 6 PDF styles |

---

## Verification Checklist

### v1.2.0 ✅ SHIPPED
- [x] All 12 PDF styles appear in Preview Modal
- [x] All/Yearly/Monthly filter tabs in PDFPreviewModal
- [x] Monthly styles (Parchment Scroll, Photo Showcase, Orchid Elegance, Monthly Portrait) grouped at bottom
- [x] "Every Day in Hebrew" (formerly Hebrew Date Focus) and "Orchid Elegance" (formerly Elegant Feminine) renamed
- [x] Template descriptions cleaned up (no "Israeli", no "ketubah")
- [x] `cropLogoImage` black box fixed (white fill before clip)
- [x] Photo Showcase crash fixed (removed non-existent saveGraphicsState)
- [x] Parchment Scroll logo routing through cropLogoImage
- [x] Diamond band replaced with reliable doc.line() + doc.circle()
- [x] `src/version.js` v1.2.0 appears in DiagnosticsModal + Settings footer
- [x] PPTX removed from main export menu; Print demoted
- [x] Settings fields persist across sessions (deep-merge on hydration)
- [x] Banner photo upload UI in SettingsDrawer with size guidance
- [ ] Template 11: Hebrew date numbers verified correct for multiple months (manual QA)
- [ ] Template 10: Photo banner upload verified in generated PDF
- [ ] Git tag `v1.2.0` created on GitHub (needs GitHub Actions or manual tag)

### v1.1.0 (verified)
- [x] Auth: register → success screen → onboarding → calendar loads
- [x] Cloud sync: edit on device A → refresh device B → changes appear
- [x] Logo shapes work in all 6 PDF styles
- [x] Sidebar blocks drag to reorder; order reflected in PDF
- [x] Diagnostics modal shows error log + userId + school code
