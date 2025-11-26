/**
 * API Endpoint: Simulate Price Change Action
 *
 * Read-only simulation of price changes and their impact on revenue.
 * Always returns simulation results without modifying data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams } from '@/lib/ai/types'

export async function POST(request: NextRequest) {
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

    // 2. Parse request body
    const body = await request.json()
    const { service_id, change_type, change_value, clinic_id } = body

    // 3. Validate required parameters
    if (!change_type || !['percentage', 'fixed'].includes(change_type)) {
      return NextResponse.json(
        { error: 'change_type must be "percentage" or "fixed"' },
        { status: 400 }
      )
    }

    if (change_value === undefined || change_value === null) {
      return NextResponse.json({ error: 'change_value is required' }, { status: 400 })
    }

    if (!clinic_id) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

    // 4. Verify user has access to the clinic
    const { data: membership, error: membershipError } = await supabase
      .from('clinic_memberships')
      .select('clinic_id')
      .eq('clinic_id', clinic_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You do not have access to this clinic' },
        { status: 403 }
      )
    }

    // 5. Build action parameters
    const params: ActionParams['simulate_price_change'] = {
      service_id: service_id || undefined,
      change_type,
      change_value,
    }

    // 6. Execute action via AIService (always read-only, no dryRun needed)
    // Use supabaseAdmin for consistency (membership already verified)
    const result = await aiService.execute('simulate_price_change', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun: false, // This action is always read-only
    })

    // 7. Return result
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          data: result,
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[API] /api/actions/simulate-price-change error:', error)
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
