import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'
import { listConvexTable, patchConvexDocumentByLegacyId } from '@/lib/convex/server'

// QA route contract: @qa-self-service-route authenticated current-user push unsubscription.
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
    const parsed = validateSchema(unsubscribeSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const body: UnsubscribeBody = parsed.data

    // Convex-only write path: supabaseAdmin is unreachable, so its .update() below
    // would throw on the first .from() call. Mirror the same deactivation: the
    // Supabase update matches push_subscriptions rows by user_id + endpoint (NOT
    // clinic-scoped) and sets is_active:false. patch helpers key on the legacy id,
    // so we read the table, filter on the same (user_id, endpoint) predicate, and
    // patch each match to is_active:false (also bumping updated_at, a Postgres-
    // default column Convex does not maintain automatically).
    if (shouldUseConvexOnlyWritePath('push_subscriptions')) {
      const rows = (await listConvexTable('push_subscriptions')) as Array<Record<string, any>>
      const matches = rows.filter(
        (row) =>
          String(row.user_id) === String(clinicContext.userId) &&
          String(row.endpoint) === String(body.endpoint)
      )
      const now = new Date().toISOString()
      for (const row of matches) {
        await patchConvexDocumentByLegacyId('push_subscriptions', String(row.id), {
          is_active: false,
          updated_at: now,
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription removed'
      })
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
