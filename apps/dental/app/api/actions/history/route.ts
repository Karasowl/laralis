/**
 * API Endpoint: Action History
 *
 * Retrieves audit trail of all actions executed by Lara.
 * Supports filtering by action type, user, and date range.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aiService } from '@/lib/ai/service'
import { assertClinicAccess } from '@/lib/auth/verify-clinic-access'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

/**
 * Replicates aiService.getActionHistoryWithClient against the Convex mirror.
 * Reads action_logs scoped to the clinic, applies the SAME filtering, ordering
 * (executed_at desc), 100-row cap, and maps rows to the identical ActionResult shape.
 */
async function getActionHistoryFromConvex(
  clinicId: string,
  filters: { action?: string; userId?: string; startDate?: string; endDate?: string }
) {
  try {
  // NOTE: action_logs is an audit log; the 10000 cap is well above realistic
  // per-clinic volumes. If a clinic ever exceeds it, the most-recent window
  // could be truncated before the sort below — acceptable for an audit trail.
  let rows = (await listConvexDocumentsByClinic('action_logs', clinicId, 10000)) as ImportedRecord[]

  rows = rows.filter((row) => {
    if (filters.action && row.action_type !== filters.action) return false
    if (filters.userId && row.user_id !== filters.userId) return false
    if (filters.startDate && String(row.executed_at || '') < filters.startDate) return false
    if (filters.endDate && String(row.executed_at || '') > filters.endDate) return false
    return true
  })

  rows = rows.sort((a, b) => String(b.executed_at || '').localeCompare(String(a.executed_at || '')))
  rows = rows.slice(0, 100)

  return rows.map((row) => {
    const log = normalizeConvexRecord(row)
    return {
      success: log.success,
      action: log.action_type,
      params: log.params,
      result: log.result,
      error: log.error_code
        ? {
            code: log.error_code,
            message: log.error_message,
            details: log.error_details,
          }
        : undefined,
      executed_at: log.executed_at,
      executed_by: log.user_id,
    }
  })
  } catch (error) {
    // Fail-soft to match the Supabase path (getActionHistoryWithClient
    // returns [] on error, HTTP 200), instead of bubbling a 500.
    console.error('[actions/history] Convex read failed, returning empty:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinic_id')
    const action = searchParams.get('action')
    const userId = searchParams.get('user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // 3. Validate required parameters
    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinicId, supabase)
    if (accessDenied) return accessDenied

    // 5. Build filters
    const filters: any = {}
    if (action) filters.action = action
    if (userId) filters.userId = userId
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate

    // 6. Get action history.
    // Convex read branch is gated by flag and placed AFTER auth + clinic membership
    // (the Convex bridge has no RLS). Replicates the same filtering/order/shape.
    let history
    if (shouldReturnConvexData('action_logs')) {
      history = await getActionHistoryFromConvex(clinicId, filters)
    } else {
      history = await aiService.getActionHistoryWithClient(supabase, clinicId, filters)
    }

    // 7. Return results
    return NextResponse.json(
      {
        success: true,
        data: history,
        count: history.length,
        filters,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[API] /api/actions/history error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Internal server error',
        },
      },
      { status: 500 }
    )
  }
}
