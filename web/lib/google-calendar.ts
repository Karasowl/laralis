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

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

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
 * Save clinic calendar configuration
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
): Promise<string | null> {
  // Only sync pending treatments
  if (treatment.status !== 'pending' && treatment.status !== 'scheduled') {
    // If treatment is no longer pending and has an event, delete it
    if (treatment.google_event_id) {
      await deleteTreatmentFromCalendar(clinicId, treatment.google_event_id)
      return null
    }
    return treatment.google_event_id
  }

  const accessToken = await getValidAccessToken(clinicId)
  if (!accessToken) {
    return null // Calendar not connected
  }

  const config = await getClinicCalendarConfig(clinicId)
  if (!config) {
    return null
  }

  // Build event start/end times
  const startTime = treatment.treatment_time || '09:00'
  const startDateTime = `${treatment.treatment_date}T${startTime}:00`
  const endDate = new Date(`${treatment.treatment_date}T${startTime}:00`)
  endDate.setMinutes(endDate.getMinutes() + (treatment.duration_minutes || 30))
  const endDateTime = endDate.toISOString().replace('Z', '')

  const event: CalendarEvent = {
    summary: `${treatment.patient_name} - ${treatment.service_name}`,
    description: `Cita dental - ${treatment.service_name}`,
    start: { dateTime: startDateTime },
    end: { dateTime: endDateTime.split('.')[0] },
  }

  try {
    if (treatment.google_event_id) {
      // Update existing event
      await updateCalendarEvent(accessToken, config.calendar_id, treatment.google_event_id, event)
      return treatment.google_event_id
    } else {
      // Create new event
      const eventId = await createCalendarEvent(accessToken, config.calendar_id, event)
      return eventId
    }
  } catch (error) {
    console.error('Failed to sync treatment to calendar:', error)
    return null
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
