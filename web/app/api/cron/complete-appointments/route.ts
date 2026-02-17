import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * Cron endpoint to auto-complete past appointments at midnight.
 * Only affects clinics that have auto_complete_appointments enabled.
 *
 * Schedule: 0 1 * * * (daily at 00:01 UTC)
 * Vercel Cron will call this endpoint automatically.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require auth. In development, allow without.
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get clinics with auto-complete enabled
    const { data: clinics, error: clinicsError } = await supabaseAdmin
      .from('clinics')
      .select('id')
      .eq('auto_complete_appointments', true)

    if (clinicsError) {
      console.error('[cron/complete-appointments] Error fetching clinics:', clinicsError)
      return NextResponse.json({ error: 'Failed to fetch clinics' }, { status: 500 })
    }

    if (!clinics || clinics.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No clinics with auto-complete enabled',
        updated: 0
      })
    }

    const clinicIds = clinics.map(c => c.id)

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    // Update past appointments to completed
    // Only affects pending/scheduled appointments from before today
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('treatments')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .lt('treatment_date', today)
      .in('status', ['pending', 'scheduled'])
      .in('clinic_id', clinicIds)
      .select('id')

    if (updateError) {
      console.error('[cron/complete-appointments] Error updating treatments:', updateError)
      return NextResponse.json({ error: 'Failed to update treatments' }, { status: 500 })
    }

    const count = updated?.length || 0
    console.info(`[cron/complete-appointments] Auto-completed ${count} appointments for ${clinicIds.length} clinics`)

    return NextResponse.json({
      success: true,
      updated: count,
      clinics: clinicIds.length
    })
  } catch (error) {
    console.error('[cron/complete-appointments] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
