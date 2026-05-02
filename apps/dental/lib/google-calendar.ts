/**
 * Google Calendar Integration Helper
 *
 * Provides OAuth 2.0 authentication and Google Calendar API operations
 * for syncing treatments as calendar events.
 *
 * Environment variables required:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI (default: http://localhost:3000/api/auth/google-calendar/callback)
 */

import { supabaseAdmin } from './supabaseAdmin'

// Types
export interface GoogleTokens {
  access_token: string
  refresh_token: string
  expires_at: number // Unix timestamp
}

export interface GoogleCalendar {
  id: string
  summary: string
  primary?: boolean
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone?: string
  }
  end: {
    dateTime: string
    timeZone?: string
  }
}

export interface ClinicCalendarConfig {
  id: string
  clinic_id: string
  calendar_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  connected_email: string | null
  is_active: boolean
}

// Constants
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// Default timezone for calendar events (Mexico City)
const DEFAULT_TIMEZONE = 'America/Mexico_City'

// Treatment statuses that should be synced to Google Calendar
const SYNCABLE_STATUSES = ['pending', 'scheduled', 'in_progress'] as const

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

// Sync result for better error handling
export interface CalendarSyncResult {
  success: boolean
  eventId?: string | null
  error?: {
    code: 'not_connected' | 'token_expired' | 'api_error' | 'invalid_status'
    message: string
  }
}

/**
 * Get Google OAuth configuration from environment
 */
function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google-calendar/callback'

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
  }

  return { clientId, clientSecret, redirectUri }
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthUrl(state: string): string {
  const { clientId, redirectUri } = getConfig()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getConfig()

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  const data = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getConfig()

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  const data = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Keep the same refresh token
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

/**
 * Get user email from Google
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to get user info')
  }

  const data = await response.json()
  return data.email
}

/**
 * List available calendars
 */
export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to list calendars')
  }

  const data = await response.json()
  return data.items || []
}

/**
 * Get valid access token for a clinic, refreshing if necessary
 */
export async function getValidAccessToken(clinicId: string): Promise<string | null> {
  const { data: config } = await supabaseAdmin
    .from('clinic_google_calendar')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .single()

  if (!config) {
    return null
  }

  const expiresAt = new Date(config.token_expires_at).getTime()

  // If token expires in less than 5 minutes, refresh it
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    try {
      const newTokens = await refreshAccessToken(config.refresh_token)

      await supabaseAdmin
        .from('clinic_google_calendar')
        .update({
          access_token: newTokens.access_token,
          token_expires_at: new Date(newTokens.expires_at).toISOString(),
        })
        .eq('id', config.id)

      return newTokens.access_token
    } catch (error) {
      console.error('Failed to refresh Google token:', error)
      // Mark as inactive if refresh fails
      await supabaseAdmin
        .from('clinic_google_calendar')
        .update({ is_active: false })
        .eq('id', config.id)
      return null
    }
  }

  return config.access_token
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent
): Promise<string> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create event: ${error}`)
  }

  const data = await response.json()
  return data.id
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: CalendarEvent
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update event: ${error}`)
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  // 404 is OK (event already deleted)
  if (!response.ok && response.status !== 404) {
    const error = await response.text()
    throw new Error(`Failed to delete event: ${error}`)
  }
}

/**
 * Get clinic calendar configuration
 */
export async function getClinicCalendarConfig(clinicId: string): Promise<ClinicCalendarConfig | null> {
  const { data } = await supabaseAdmin
    .from('clinic_google_calendar')
    .select('*')
    .eq('clinic_id', clinicId)
    .single()

  return data
}

/**
 * Save clinic calendar configuration (with selected calendar)
 */
export async function saveClinicCalendarConfig(
  clinicId: string,
  tokens: GoogleTokens,
  calendarId: string,
  email: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('clinic_google_calendar').upsert(
    {
      clinic_id: clinicId,
      calendar_id: calendarId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at).toISOString(),
      connected_email: email,
      is_active: true,
    },
    {
      onConflict: 'clinic_id',
    }
  )

  if (error) {
    throw new Error(`Failed to save calendar config: ${error.message}`)
  }
}

/**
 * Save clinic calendar tokens temporarily (before calendar selection)
 * Saves with is_active = false until user selects a calendar
 */
export async function saveClinicCalendarTokens(
  clinicId: string,
  tokens: GoogleTokens,
  email: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('clinic_google_calendar').upsert(
    {
      clinic_id: clinicId,
      calendar_id: 'pending_selection', // Placeholder until user selects
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(tokens.expires_at).toISOString(),
      connected_email: email,
      is_active: false, // Not active until calendar is selected
    },
    {
      onConflict: 'clinic_id',
    }
  )

  if (error) {
    throw new Error(`Failed to save calendar tokens: ${error.message}`)
  }
}

/**
 * Complete calendar connection by selecting a calendar
 */
export async function completeCalendarConnection(
  clinicId: string,
  calendarId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('clinic_google_calendar')
    .update({
      calendar_id: calendarId,
      is_active: true,
    })
    .eq('clinic_id', clinicId)

  if (error) {
    throw new Error(`Failed to complete calendar connection: ${error.message}`)
  }
}

/**
 * Get pending calendar connection (tokens saved but calendar not selected)
 */
export async function getPendingCalendarConfig(clinicId: string): Promise<ClinicCalendarConfig | null> {
  const { data } = await supabaseAdmin
    .from('clinic_google_calendar')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', false)
    .single()

  return data
}

/**
 * Delete clinic calendar configuration (disconnect)
 */
export async function deleteClinicCalendarConfig(clinicId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('clinic_google_calendar')
    .delete()
    .eq('clinic_id', clinicId)

  if (error) {
    throw new Error(`Failed to delete calendar config: ${error.message}`)
  }
}

/**
 * Sync a treatment to Google Calendar
 * Returns a structured result for better error handling in UI
 */
export async function syncTreatmentToCalendar(
  clinicId: string,
  treatment: {
    id: string
    patient_name: string
    service_name: string
    treatment_date: string
    treatment_time: string | null
    duration_minutes: number
    status: string
    google_event_id: string | null
  }
): Promise<CalendarSyncResult> {
  // Only sync treatments with syncable statuses (pending, scheduled, in_progress)
  const isSyncable = SYNCABLE_STATUSES.includes(treatment.status as typeof SYNCABLE_STATUSES[number])

  if (!isSyncable) {
    // If treatment is no longer syncable and has an event, delete it
    if (treatment.google_event_id) {
      await deleteTreatmentFromCalendar(clinicId, treatment.google_event_id)
    }
    return {
      success: true,
      eventId: null,
      error: treatment.google_event_id ? undefined : {
        code: 'invalid_status',
        message: `Status '${treatment.status}' is not synced to calendar`
      }
    }
  }

  const accessToken = await getValidAccessToken(clinicId)
  if (!accessToken) {
    return {
      success: false,
      error: { code: 'not_connected', message: 'Google Calendar not connected' }
    }
  }

  const config = await getClinicCalendarConfig(clinicId)
  if (!config) {
    return {
      success: false,
      error: { code: 'not_connected', message: 'Calendar configuration not found' }
    }
  }

  // Build event start/end times with proper timezone
  const startTime = treatment.treatment_time || '09:00'
  const startDateTime = `${treatment.treatment_date}T${startTime}:00`

  // Calculate end time by adding duration to start time
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const totalMinutes = startHour * 60 + startMinute + (treatment.duration_minutes || 30)
  const endHour = Math.floor(totalMinutes / 60) % 24
  const endMinute = totalMinutes % 60
  const endDateTime = `${treatment.treatment_date}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`

  const event: CalendarEvent = {
    summary: `${treatment.patient_name} - ${treatment.service_name}`,
    description: `Cita dental - ${treatment.service_name}`,
    start: {
      dateTime: startDateTime,
      timeZone: DEFAULT_TIMEZONE
    },
    end: {
      dateTime: endDateTime,
      timeZone: DEFAULT_TIMEZONE
    },
  }

  try {
    if (treatment.google_event_id) {
      // Update existing event
      await updateCalendarEvent(accessToken, config.calendar_id, treatment.google_event_id, event)
      return { success: true, eventId: treatment.google_event_id }
    } else {
      // Create new event
      const eventId = await createCalendarEvent(accessToken, config.calendar_id, event)
      return { success: true, eventId }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to sync treatment to calendar:', error)
    return {
      success: false,
      eventId: treatment.google_event_id,
      error: { code: 'api_error', message }
    }
  }
}

/**
 * Delete a treatment event from Google Calendar
 */
export async function deleteTreatmentFromCalendar(clinicId: string, eventId: string): Promise<void> {
  const accessToken = await getValidAccessToken(clinicId)
  if (!accessToken) {
    return
  }

  const config = await getClinicCalendarConfig(clinicId)
  if (!config) {
    return
  }

  try {
    await deleteCalendarEvent(accessToken, config.calendar_id, eventId)
  } catch (error) {
    console.error('Failed to delete event from calendar:', error)
  }
}
