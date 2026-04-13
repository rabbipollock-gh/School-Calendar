// Single source of truth for the app version.
// Bump this whenever releasing — the GitHub Actions workflow
// will auto-create a git tag and GitHub Release when this changes.
//
// Rules:
//   PATCH (1.1.x) — bug fixes, copy tweaks, no new features
//   MINOR (1.x.0) — new features (templates, exports, settings)
//   MAJOR (x.0.0) — paradigm shift (new monetization model, full redesign)
//                   *** Always confirm with user before bumping major ***

export const APP_VERSION = '1.2.0'
