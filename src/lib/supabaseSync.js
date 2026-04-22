import { supabase } from './supabase.js'
import { logger } from '../utils/logger.js'

// ── Load one calendar's data by slug ────────────────────────────────────────
export async function loadFromCloud(userId, slug) {
  logger.debug('sync', 'loadFromCloud called', { userId, slug })
  const { data, error } = await supabase
    .from('calendars')
    .select('data, updated_at')
    .eq('user_id', userId)
    .eq('slug', slug)
    .maybeSingle()

  if (error) { logger.error('sync', 'loadFromCloud error', { error: error.message }); return null }
  if (!data) { logger.info('sync', 'no cloud data found for user/slug', { slug }); return null }
  logger.info('sync', 'loaded cloud data', { slug, updatedAt: data.updated_at })
  return { data: data.data, updatedAt: data.updated_at }
}

// ── Save one calendar's data + metadata (upsert by user_id + slug) ──────────
export async function saveToCloud(userId, slug, calendarState) {
  const { events, categories, schoolInfo, settings, hebrewEventToggles } = calendarState
  logger.debug('sync', 'saveToCloud called', { userId, slug })
  const { error } = await supabase.from('calendars').upsert(
    {
      user_id: userId,
      slug,
      name: schoolInfo?.name || 'My Calendar',
      academic_year: settings?.academicYear || '',
      data: { events, categories, schoolInfo, settings, hebrewEventToggles },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,slug' }
  )
  if (error) logger.error('sync', 'saveToCloud error', { error: error.message })
  else logger.info('sync', 'saved to cloud successfully', { slug })
}

// ── Load all calendars for user (metadata only — no heavy data) ─────────────
export async function loadAllCalendarsFromCloud(userId) {
  logger.debug('sync', 'loadAllCalendarsFromCloud called', { userId })
  const { data, error } = await supabase
    .from('calendars')
    .select('slug, name, academic_year, status, updated_at, deleted_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) { logger.error('sync', 'loadAllCalendarsFromCloud error', { error: error.message }); return null }
  logger.info('sync', 'loaded all calendar entries', { count: data?.length })
  return data || []
}

// ── Update a calendar's status without touching its data ────────────────────
export async function updateCalendarStatus(userId, slug, status, deletedAt = null) {
  logger.debug('sync', 'updateCalendarStatus called', { userId, slug, status })
  const { error } = await supabase
    .from('calendars')
    .update({ status, deleted_at: deletedAt, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('slug', slug)
  if (error) logger.error('sync', 'updateCalendarStatus error', { error: error.message })
  else logger.info('sync', 'calendar status updated', { slug, status })
}

// ── Hard-delete a calendar row (only for "Permanently Delete") ───────────────
export async function permanentlyDeleteFromCloud(userId, slug) {
  logger.debug('sync', 'permanentlyDeleteFromCloud called', { userId, slug })
  const { error } = await supabase
    .from('calendars')
    .delete()
    .eq('user_id', userId)
    .eq('slug', slug)
  if (error) logger.error('sync', 'permanentlyDeleteFromCloud error', { error: error.message })
  else logger.info('sync', 'calendar permanently deleted from cloud', { slug })
}

// ── Debounce helper ──────────────────────────────────────────────────────────
export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
