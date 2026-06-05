import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireCronAuth } from '@/lib/cron-auth'
import { listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Cron endpoint to auto-complete past appointments at midnight.
 * Only affects clinics that have auto_complete_appointments enabled.
 *
 * Schedule: 0 1 * * * (daily at 00:01 UTC)
 * Vercel Cron will call this endpoint automatically.
 */
export async function GET(request: NextRequest) {
  try {
    const denied = requireCronAuth(request)
    if (denied) return denied

    // Get clinics with auto-complete enabled. clinics has no clinic_id column
    // (keyed by id) and this read is workspace-agnostic, so the Convex branch
    // reads the whole table and filters in JS. Flag-gated, default Supabase.
    let clinics: Array<{ id: any }> | null
    if (shouldReturnConvexData('clinics')) {
      clinics = (await listConvexTable('clinics', 10000) as ImportedRecord[])
        .map(normalizeConvexRecord)
        .filter((row) => row.auto_complete_appointments === true)
        .map((row) => ({ id: row.id }))
    } else {
      const { data, error: clinicsError } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('auto_complete_appointments', true)

      if (clinicsError) {
        console.error('[cron/complete-appointments] Error fetching clinics:', clinicsError)
        return NextResponse.json({ error: 'Failed to fetch clinics' }, { status: 500 })
      }
      clinics = data
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
