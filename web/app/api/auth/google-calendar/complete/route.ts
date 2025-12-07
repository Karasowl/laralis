/**
 * Complete Google Calendar Connection
 *
 * Finalizes the calendar connection after user selects a calendar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import {
  completeCalendarConnection,
  getPendingCalendarConfig,
} from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

/**
 * POST: Complete calendar connection with selected calendar
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()

    const clinicContext = await resolveClinicContext({
      requestedClinicId: null,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const { clinicId } = clinicContext

    // Verify there's a pending connection
    const pending = await getPendingCalendarConfig(clinicId)
    if (!pending) {
      return NextResponse.json(
        { error: 'No pending calendar connection found' },
        { status: 400 }
      )
    }

    // Get selected calendar from body
    const body = await request.json()
    const { calendarId } = body

    if (!calendarId) {
      return NextResponse.json(
        { error: 'Calendar ID is required' },
        { status: 400 }
      )
    }

    // Complete the connection
    await completeCalendarConnection(clinicId, calendarId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to complete calendar connection:', error)
    return NextResponse.json(
      { error: 'Failed to complete connection' },
      { status: 500 }
    )
  }
}
