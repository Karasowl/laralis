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
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const completeCalendarSchema = z.object({
  calendarId: z.string().min(1),
})

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
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(completeCalendarSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { calendarId } = parsed.data

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
