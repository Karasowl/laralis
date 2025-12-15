import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'

interface SubscribeBody {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * POST /api/notifications/push/subscribe
 *
 * Saves a Web Push subscription to the database
 *
 * Request body:
 * {
 *   endpoint: string,
 *   expirationTime?: number | null,
 *   keys: {
 *     p256dh: string,
 *     auth: string
 *   }
 * }
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

    const body: SubscribeBody = await request.json()

    // Validate request body
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint, keys.p256dh, keys.auth' },
        { status: 400 }
      )
    }

    // Extract device info from headers
    const userAgent = request.headers.get('user-agent') || undefined
    const deviceName = extractDeviceName(userAgent)

    // Check if subscription already exists
    const { data: existing } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', clinicContext.userId)
      .eq('endpoint', body.endpoint)
      .single()

    if (existing) {
      // Update existing subscription
      const { error: updateError } = await supabaseAdmin
        .from('push_subscriptions')
        .update({
          expiration_time: body.expirationTime
            ? new Date(body.expirationTime).toISOString()
            : null,
          keys_p256dh: body.keys.p256dh,
          keys_auth: body.keys.auth,
          user_agent: userAgent,
          device_name: deviceName,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('[Push Subscribe] Update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update subscription' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription updated',
        id: existing.id
      })
    }

    // Create new subscription
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .insert({
        clinic_id: clinicContext.clinicId,
        user_id: clinicContext.userId,
        endpoint: body.endpoint,
        expiration_time: body.expirationTime
          ? new Date(body.expirationTime).toISOString()
          : null,
        keys_p256dh: body.keys.p256dh,
        keys_auth: body.keys.auth,
        user_agent: userAgent,
        device_name: deviceName,
        is_active: true
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Push Subscribe] Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription created',
      id: data.id
    })
  } catch (err) {
    console.error('[Push Subscribe] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Extract a human-readable device name from user agent string
 */
function extractDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device'

  // Mobile devices
  if (/iPhone/.test(userAgent)) return 'iPhone'
  if (/iPad/.test(userAgent)) return 'iPad'
  if (/Android/.test(userAgent)) return 'Android'

  // Desktop browsers
  if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) return 'Chrome'
  if (/Firefox/.test(userAgent)) return 'Firefox'
  if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return 'Safari'
  if (/Edge/.test(userAgent)) return 'Edge'

  return 'Desktop'
}
