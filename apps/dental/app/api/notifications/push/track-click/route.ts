import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { shouldUseConvexOnlyWritePath } from '@/lib/data-backend'
import { patchConvexDocumentByLegacyId } from '@/lib/convex/server'

// QA route contract: @qa-public-route service-worker click tracking by opaque notification id.
interface TrackClickBody {
  notificationId: string
}

const trackClickSchema = z.object({
  notificationId: z.string().uuid(),
})

/**
 * POST /api/notifications/push/track-click
 *
 * Tracks when a user clicks on a push notification
 * Called by the Service Worker
 */
export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(trackClickSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const body: TrackClickBody = parsed.data

    // Convex-only write path: replicate the push_notifications status update
    // directly, since supabaseAdmin is unreachable in this mode. Mirrors the
    // Supabase `.update().eq('id', ...)` below (same `status`/`clicked_at` patch).
    // patchByLegacyId is a no-op when the id matches no row, matching Supabase's
    // silent-success-on-no-match semantics (the SW posts opaque ids).
    if (shouldUseConvexOnlyWritePath('push_notifications')) {
      await patchConvexDocumentByLegacyId('push_notifications', body.notificationId, {
        status: 'clicked',
        clicked_at: new Date().toISOString(),
      })
      return NextResponse.json({ success: true })
    }

    // Update notification status
    const { error } = await supabaseAdmin
      .from('push_notifications')
      .update({
        status: 'clicked',
        clicked_at: new Date().toISOString()
      })
      .eq('id', body.notificationId)

    if (error) {
      console.error('[Track Click] Error:', error)
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Track Click] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
