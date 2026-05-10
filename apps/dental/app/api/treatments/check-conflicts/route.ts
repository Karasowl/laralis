import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { checkScheduleConflicts } from '@/lib/calendar/server-conflicts'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const conflictSchema = z.object({
  clinic_id: z.string().uuid().optional(),
  date: z.string().min(1),
  time: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive().optional(),
  exclude_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(conflictSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const body = parsed.data
    const cookieStore = cookies()

    const clinicContext = await resolveClinicContext({
      requestedClinicId: body?.clinic_id,
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const { clinicId, userId } = clinicContext
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'treatments.create')
    if (forbidden) return forbidden

    const { date, time, duration_minutes, exclude_id } = body

    const duration = duration_minutes || 30

    const result = await checkScheduleConflicts({
      clinicId,
      date,
      time,
      durationMinutes: duration,
      excludeId: exclude_id,
    })

    return NextResponse.json({
      hasConflict: result.hasConflict,
      conflicts: result.conflicts,
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/treatments/check-conflicts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
