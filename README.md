# YAYOE Calendar Builder

A production-ready Progressive Web App (PWA) for **Yeshiva Aharon Yaakov Ohr Eliyahu** — a full-featured Jewish school academic calendar builder for the 2026–2027 school year.

## Live Features

- 📅 11-month calendar grid (August 2026 – June 2027)
- ✡️ SHA (Shabbat) column always highlighted in teal
- 🌙 Shabbat/Shabbos label toggle
- 📖 Hebrew month labels (e.g. Nissan–Iyar)
- 🗓 50+ pre-loaded school events for YAYOE
- ➕ Click any day to add/edit/delete events
- 📆 Bulk date range entry
- 🔍 Cmd+K event search
- ↩ Undo/Redo (Cmd+Z, 20-deep stack)
- 🔗 Share via URL (lz-string compressed, read-only for recipients)
- 🔒 Lock/read-only mode
- ✡️ Holiday Suggestions Panel (all 5787 Jewish holidays)
- ⚠️ Conflict detection & review panel
- 🎨 Category manager (9 defaults + custom, color picker)
- 📄 PDF export (jsPDF, with logo, legend, notes strip)
- 📊 PPTX export (pptxgenjs, Canva-compatible)
- 📅 ICS export (Google/Apple/Outlook calendar import)
- 📋 CSV export
- 🖨️ Browser print fallback
- 💾 Auto-save to localStorage
- 📱 Mobile responsive + PWA (offline capable, installable)
- 🌙 Dark mode (system preference)

## Tech Stack

- **React 19** + **Vite 8**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **jsPDF** — PDF generation
- **pptxgenjs** — PowerPoint generation
- **ics** — iCalendar file generation
- **lz-string** — URL state compression for sharing
- **vite-plugin-pwa** — Service worker + offline support

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # Production build → dist/
```

## Deploy to Netlify (Free)

```bash
npm run build
# Drag the dist/ folder to netlify.com
# — or —
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## School Info

**Yeshiva Aharon Yaakov Ohr Eliyahu**  
241 S. Detroit St., Los Angeles, CA 90036  
Tel: 323-556-6900 | Fax: 323-556-6901

## License

MIT
