/**
 * Google Calendar OAuth Callback
 *
 * Handles the redirect from Google after user authorization.
 * Exchanges the code for tokens and saves the configuration.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  getUserEmail,
  listCalendars,
  saveClinicCalendarConfig,
} from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(
        new URL(`/settings/calendar?error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/settings/calendar?error=missing_params', request.url)
      )
    }

    // Decode state to get clinic ID
    let clinicId: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      clinicId = decoded.clinicId
    } catch {
      return NextResponse.redirect(
        new URL('/settings/calendar?error=invalid_state', request.url)
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Get user email
    const email = await getUserEmail(tokens.access_token)

    // Get primary calendar (or first one)
    const calendars = await listCalendars(tokens.access_token)
    const primaryCalendar = calendars.find(c => c.primary) || calendars[0]

    if (!primaryCalendar) {
      return NextResponse.redirect(
        new URL('/settings/calendar?error=no_calendars', request.url)
      )
    }

    // Save configuration
    await saveClinicCalendarConfig(clinicId, tokens, primaryCalendar.id, email)

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL('/settings/calendar?success=connected', request.url)
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/settings/calendar?error=callback_failed', request.url)
    )
  }
}
