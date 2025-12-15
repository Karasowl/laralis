import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'

interface UnsubscribeBody {
  endpoint: string
}

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

    const body: UnsubscribeBody = await request.json()

    if (!body.endpoint) {
      return NextResponse.json(
        { error: 'Missing required field: endpoint' },
        { status: 400 }
      )
    }

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
