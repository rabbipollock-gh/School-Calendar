import { supabase } from './supabase.js'
import { logger } from '../utils/logger.js'

// ── Load calendar data from Supabase ────────────────────────────────────────
export async function loadFromCloud(userId) {
  logger.debug('sync', 'loadFromCloud called', { userId })
  const { data, error } = await supabase
    .from('calendars')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) { logger.error('sync', 'loadFromCloud error', { error: error.message }); return null }
  if (!data) { logger.info('sync', 'no cloud data found for user'); return null }
  logger.info('sync', 'loaded cloud data', { updatedAt: data.updated_at })
  return { data: data.data, updatedAt: data.updated_at }
}

// ── Save calendar data to Supabase (upsert) ─────────────────────────────────
export async function saveToCloud(userId, calendarState) {
  const { events, categories, schoolInfo, settings } = calendarState
  logger.debug('sync', 'saveToCloud called', { userId })
  const { error } = await supabase.from('calendars').upsert(
    { user_id: userId, data: { events, categories, schoolInfo, settings }, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  if (error) logger.error('sync', 'saveToCloud error', { error: error.message })
  else logger.info('sync', 'saved to cloud successfully')
}

// ── Debounce helper ──────────────────────────────────────────────────────────
export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
