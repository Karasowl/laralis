/**
 * Google Calendar OAuth API
 *
 * GET: Initiate OAuth flow (redirect to Google)
 * DELETE: Disconnect calendar
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import {
  getAuthUrl,
  getClinicCalendarConfig,
  deleteClinicCalendarConfig,
  listCalendars,
  getValidAccessToken,
} from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

/**
 * GET: Start OAuth flow or get current connection status
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }

    const { clinicId } = clinicContext

    // Action: start OAuth flow
    if (action === 'connect') {
      // Create state with clinic ID for callback
      const state = Buffer.from(JSON.stringify({ clinicId })).toString('base64')
      const authUrl = getAuthUrl(state)
      return NextResponse.json({ authUrl })
    }

    // Action: list available calendars
    if (action === 'calendars') {
      const accessToken = await getValidAccessToken(clinicId)
      if (!accessToken) {
        return NextResponse.json({ error: 'Not connected' }, { status: 400 })
      }
      const calendars = await listCalendars(accessToken)
      return NextResponse.json({ calendars })
    }

    // Default: get current connection status
    const config = await getClinicCalendarConfig(clinicId)

    if (!config) {
      return NextResponse.json({
        connected: false,
        config: null,
      })
    }

    return NextResponse.json({
      connected: config.is_active,
      config: {
        calendar_id: config.calendar_id,
        connected_email: config.connected_email,
        is_active: config.is_active,
      },
    })
  } catch (error) {
    console.error('Google Calendar API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Disconnect calendar
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams

    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json({ error: clinicContext.error.message }, { status: clinicContext.error.status })
    }

    const { clinicId } = clinicContext

    await deleteClinicCalendarConfig(clinicId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to disconnect calendar:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
