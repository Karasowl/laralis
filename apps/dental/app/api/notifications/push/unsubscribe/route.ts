import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

interface UnsubscribeBody {
  endpoint: string
}

const unsubscribeSchema = z.object({
  endpoint: z.string().min(1),
})

/**
 * POST /api/notifications/push/unsubscribe
 *
 * Removes or deactivates a push subscription
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const clinicContext = await resolveClinicContext({ cookieStore })

    if (!clinicContext.userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User not authenticated' },
        { status: 401 }
      )
    }

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(unsubscribeSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const body: UnsubscribeBody = parsed.data

    // Mark subscription as inactive instead of deleting
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', clinicContext.userId)
      .eq('endpoint', body.endpoint)

    if (error) {
      console.error('[Push Unsubscribe] Error:', error)
      return NextResponse.json(
        { error: 'Failed to unsubscribe' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription removed'
    })
  } catch (err) {
    console.error('[Push Unsubscribe] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
