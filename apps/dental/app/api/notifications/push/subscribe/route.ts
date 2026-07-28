import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'
import {
  listConvexDocumentsByClinic,
  patchConvexDocumentByLegacyId,
  upsertConvexDocumentByLegacyId,
} from '@/lib/convex/server'

// QA route contract: @qa-self-service-route authenticated current-user push subscription.
interface SubscribeBody {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

const subscribeSchema = z.object({
  endpoint: z.string().min(1),
  expirationTime: z.number().int().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

/**
 * Convex-only replication of the push_subscriptions upsert performed by POST.
 *
 * In DATA_WRITE_MODE_PUSH_SUBSCRIPTIONS=convex the Supabase backend is unreachable,
 * so supabaseAdmin.from('push_subscriptions') would throw on its first call. This
 * mirrors the route's read-then-write logic exactly:
 *   - reads the clinic's push_subscriptions and finds the existing row for this
 *     (user_id, endpoint) pair (mirrors the .single() lookup),
 *   - existing -> patches the mutable columns (mirrors the Supabase UPDATE set),
 *   - new -> inserts the row with the same columns as the Supabase INSERT plus the
 *     Postgres-default columns Convex does not fill automatically
 *     (id / is_active / last_used_at / created_at / updated_at).
 * The returned shape matches the Supabase path's response payload byte-for-byte.
 */
async function upsertPushSubscriptionInConvex(
  ctx: { clinicId: string; userId: string },
  body: SubscribeBody,
  meta: { userAgent?: string; deviceName: string }
): Promise<{ created: boolean; id: string }> {
  const { clinicId, userId } = ctx
  const expirationTime = body.expirationTime
    ? new Date(body.expirationTime).toISOString()
    : null

  // Find the existing subscription for this (user_id, endpoint) pair. There is no
  // arbitrary-filter helper, so list the clinic's rows and match in-memory (same
  // approach as userHasActiveWorkspaceMembershipFromConvex). Columns are plain
  // scalars so no JSONB decode is needed for the match.
  const rows = (await listConvexDocumentsByClinic('push_subscriptions', clinicId)) as Array<
    Record<string, any>
  >
  const existing = rows.find(
    (row) =>
      String(row.user_id) === String(userId) && String(row.endpoint) === String(body.endpoint)
  )

  if (existing) {
    const existingId = String(existing.id)
    await patchConvexDocumentByLegacyId('push_subscriptions', existingId, {
      expiration_time: expirationTime,
      keys_p256dh: body.keys.p256dh,
      keys_auth: body.keys.auth,
      user_agent: meta.userAgent ?? null,
      device_name: meta.deviceName,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    return { created: false, id: existingId }
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await upsertConvexDocumentByLegacyId('push_subscriptions', id, {
    id,
    clinic_id: clinicId,
    user_id: userId,
    endpoint: body.endpoint,
    expiration_time: expirationTime,
    keys_p256dh: body.keys.p256dh,
    keys_auth: body.keys.auth,
    user_agent: meta.userAgent ?? null,
    device_name: meta.deviceName,
    is_active: true,
    last_used_at: now,
    created_at: now,
    updated_at: now,
  })
  return { created: true, id }
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

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error.message },
        { status: clinicContext.error.status }
      )
    }

    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(subscribeSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const body: SubscribeBody = parsed.data

    // Extract device info from headers
    const userAgent = request.headers.get('user-agent') || undefined
    const deviceName = extractDeviceName(userAgent)

    // Convex-only write path: replicate the read-then-upsert directly, since
    // supabaseAdmin is unreachable in this mode.
    if (shouldUseConvexOnlyWritePath('push_subscriptions')) {
      const { created, id } = await upsertPushSubscriptionInConvex(
        { clinicId: clinicContext.clinicId, userId: clinicContext.userId },
        body,
        { userAgent, deviceName }
      )
      return NextResponse.json({
        success: true,
        message: created ? 'Subscription created' : 'Subscription updated',
        id,
      })
    }

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
