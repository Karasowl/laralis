/**
 * API Endpoint: Action History
 *
 * Retrieves audit trail of all actions executed by Lara.
 * Supports filtering by action type, user, and date range.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aiService } from '@/lib/ai/service'

export const dynamic = 'force-dynamic'

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

    // 4. Verify user has access to the clinic
    const { data: membership, error: membershipError } = await supabase
      .from('clinic_memberships')
      .select('clinic_id')
      .eq('clinic_id', clinicId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You do not have access to this clinic' },
        { status: 403 }
      )
    }

    // 5. Build filters
    const filters: any = {}
    if (action) filters.action = action
    if (userId) filters.userId = userId
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate

    // 6. Get action history
    const history = await aiService.getActionHistoryWithClient(supabase, clinicId, filters)

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
