import { supabase } from './supabase.js'

// ── Load calendar data from Supabase ────────────────────────────────────────
export async function loadFromCloud(userId) {
  console.log('[CloudSync] loadFromCloud called, userId:', userId)
  const { data, error } = await supabase
    .from('calendars')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) { console.error('[CloudSync] loadFromCloud error:', error); return null }
  if (!data) { console.log('[CloudSync] no cloud data found for user'); return null }
  console.log('[CloudSync] loaded cloud data, updated_at:', data.updated_at)
  return { data: data.data, updatedAt: data.updated_at }
}

// ── Save calendar data to Supabase (upsert) ─────────────────────────────────
export async function saveToCloud(userId, calendarState) {
  const { events, categories, schoolInfo, settings } = calendarState
  console.log('[CloudSync] saveToCloud called, userId:', userId)
  const { error } = await supabase.from('calendars').upsert(
    { user_id: userId, data: { events, categories, schoolInfo, settings }, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  if (error) console.error('[CloudSync] saveToCloud error:', error)
  else console.log('[CloudSync] saved to cloud successfully')
}

// ── Debounce helper ──────────────────────────────────────────────────────────
export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
