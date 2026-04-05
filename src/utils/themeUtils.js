/**
 * Theme system for YAYOE Calendar Builder
 * Each theme defines a primary color, accent, and derived palette.
 * CSS custom properties are applied to :root so all components
 * can reference var(--color-primary), var(--color-accent), etc.
 */

export const THEME_MAP = {
  'navy-gold': {
    id: 'navy-gold',
    name: 'Navy & Gold',
    primary: '#1e3a5f',
    primaryLight: '#2a4d7a',
    primaryDark: '#0f2744',
    accent: '#D4AF37',
    accentLight: '#e8c84a',
    textOnPrimary: '#ffffff',
    textOnAccent: '#1e3a5f',
    shabbatBg: '#e1e8f2',
    headerSubText: '#93c5fd',
    group: 'Classic',
  },
  'blue-white': {
    id: 'blue-white',
    name: 'Blue & White',
    primary: '#1a56db',
    primaryLight: '#2563eb',
    primaryDark: '#1339a8',
    accent: '#ffffff',
    accentLight: '#f0f4ff',
    textOnPrimary: '#ffffff',
    textOnAccent: '#1a56db',
    shabbatBg: '#dbeafe',
    headerSubText: '#bfdbfe',
    group: 'Classic',
  },
  'green-gold': {
    id: 'green-gold',
    name: 'Forest & Gold',
    primary: '#1a5e3a',
    primaryLight: '#1f7049',
    primaryDark: '#0f3d24',
    accent: '#D4AF37',
    accentLight: '#e8c84a',
    textOnPrimary: '#ffffff',
    textOnAccent: '#1a5e3a',
    shabbatBg: '#d1fae5',
    headerSubText: '#86efac',
    group: 'Classic',
  },
  'crimson-gray': {
    id: 'crimson-gray',
    name: 'Crimson & Gray',
    primary: '#9B2335',
    primaryLight: '#b52a3f',
    primaryDark: '#751924',
    accent: '#8A8D8F',
    accentLight: '#a0a3a5',
    textOnPrimary: '#ffffff',
    textOnAccent: '#ffffff',
    shabbatBg: '#fee2e2',
    headerSubText: '#fca5a5',
    group: 'Bold',
  },
  'purple-silver': {
    id: 'purple-silver',
    name: 'Royal Purple',
    primary: '#4B0082',
    primaryLight: '#5d0da0',
    primaryDark: '#360060',
    accent: '#C0C0C0',
    accentLight: '#d4d4d4',
    textOnPrimary: '#ffffff',
    textOnAccent: '#4B0082',
    shabbatBg: '#ede9fe',
    headerSubText: '#c4b5fd',
    group: 'Bold',
  },
  'teal-gold': {
    id: 'teal-gold',
    name: 'Teal & Gold',
    primary: '#006d6d',
    primaryLight: '#007f7f',
    primaryDark: '#004d4d',
    accent: '#D4AF37',
    accentLight: '#e8c84a',
    textOnPrimary: '#ffffff',
    textOnAccent: '#004d4d',
    shabbatBg: '#ccfbf1',
    headerSubText: '#5eead4',
    group: 'Modern',
  },
  'charcoal-orange': {
    id: 'charcoal-orange',
    name: 'Charcoal & Orange',
    primary: '#2C2C2C',
    primaryLight: '#3d3d3d',
    primaryDark: '#1a1a1a',
    accent: '#FF6B35',
    accentLight: '#ff8254',
    textOnPrimary: '#ffffff',
    textOnAccent: '#ffffff',
    shabbatBg: '#f5f5f4',
    headerSubText: '#fed7aa',
    group: 'Modern',
  },
  'slate-rose': {
    id: 'slate-rose',
    name: 'Slate & Rose',
    primary: '#3d5a80',
    primaryLight: '#4d6d98',
    primaryDark: '#2d4060',
    accent: '#E07A5F',
    accentLight: '#e89280',
    textOnPrimary: '#ffffff',
    textOnAccent: '#ffffff',
    shabbatBg: '#e0f2fe',
    headerSubText: '#bae6fd',
    group: 'Modern',
  },
  'olive-cream': {
    id: 'olive-cream',
    name: 'Olive & Cream',
    primary: '#4a5c2c',
    primaryLight: '#5a6e38',
    primaryDark: '#333f1e',
    accent: '#F7E7CE',
    accentLight: '#fdf3e3',
    textOnPrimary: '#ffffff',
    textOnAccent: '#4a5c2c',
    shabbatBg: '#f0fdf4',
    headerSubText: '#bbf7d0',
    group: 'Warm',
  },
  'midnight-sky': {
    id: 'midnight-sky',
    name: 'Midnight Sky',
    primary: '#0a0e2a',
    primaryLight: '#151b3e',
    primaryDark: '#050714',
    accent: '#9DB5FF',
    accentLight: '#b8caff',
    textOnPrimary: '#ffffff',
    textOnAccent: '#0a0e2a',
    shabbatBg: '#eef2ff',
    headerSubText: '#a5b4fc',
    group: 'Dark',
  },
  'custom': {
    id: 'custom',
    name: 'Custom',
    primary: '#1e3a5f',
    primaryLight: '#2a4d7a',
    primaryDark: '#0f2744',
    accent: '#D4AF37',
    accentLight: '#e8c84a',
    textOnPrimary: '#ffffff',
    textOnAccent: '#1e3a5f',
    shabbatBg: '#e1e8f2',
    headerSubText: '#93c5fd',
    group: 'Custom',
  },
}

/**
 * Returns the resolved theme object for the given themeId.
 * For the 'custom' theme, merges in the user's custom primary/accent.
 */
export function getTheme(themeId = 'navy-gold', customPrimary, customAccent) {
  const base = THEME_MAP[themeId] || THEME_MAP['navy-gold']
  if (themeId === 'custom' && (customPrimary || customAccent)) {
    const p = customPrimary || base.primary
    const a = customAccent || base.accent
    return {
      ...base,
      primary: p,
      primaryLight: lighten(p, 0.12),
      primaryDark: darken(p, 0.15),
      accent: a,
      accentLight: lighten(a, 0.1),
    }
  }
  return base
}

/** Applies a theme to CSS custom properties on :root */
export function applyThemeToCss(theme) {
  const root = document.documentElement
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty('--color-primary-light', theme.primaryLight)
  root.style.setProperty('--color-primary-dark', theme.primaryDark)
  root.style.setProperty('--color-accent', theme.accent)
  root.style.setProperty('--color-accent-light', theme.accentLight)
  root.style.setProperty('--color-text-on-primary', theme.textOnPrimary)
  root.style.setProperty('--color-text-on-accent', theme.textOnAccent)
  root.style.setProperty('--color-shabbat-bg', theme.shabbatBg)
  root.style.setProperty('--color-header-sub', theme.headerSubText)
}

/** Simple hex color lightener (adds white mix) */
function lighten(hex, amount) {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.min(255, Math.round(r + (255 - r) * amount)),
    Math.min(255, Math.round(g + (255 - g) * amount)),
    Math.min(255, Math.round(b + (255 - b) * amount))
  )
}

/** Simple hex color darkener */
function darken(hex, amount) {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount)))
  )
}

export function hexToRgb(hex) {
  const clean = (hex || '#999999').replace('#', '').padEnd(6, '9')
  return [
    parseInt(clean.slice(0, 2), 16) || 153,
    parseInt(clean.slice(2, 4), 16) || 153,
    parseInt(clean.slice(4, 6), 16) || 153,
  ]
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
