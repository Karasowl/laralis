import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface TrackClickBody {
  notificationId: string
}

/**
 * POST /api/notifications/push/track-click
 *
 * Tracks when a user clicks on a push notification
 * Called by the Service Worker
 */
export async function POST(request: NextRequest) {
  try {
    const body: TrackClickBody = await request.json()

    if (!body.notificationId) {
      return NextResponse.json(
        { error: 'Missing notificationId' },
        { status: 400 }
      )
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
