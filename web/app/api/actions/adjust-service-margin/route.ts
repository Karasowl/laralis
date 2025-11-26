/**
 * API Endpoint: Adjust Service Margin Action
 *
 * Calculates and optionally applies a new price to achieve a target margin.
 * Supports dry-run mode for calculation-only scenarios.
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
    const { service_id, target_margin_pct, adjust_price = false, clinic_id, dry_run = false } = body

    // 3. Validate required parameters
    if (!service_id) {
      return NextResponse.json({ error: 'service_id is required' }, { status: 400 })
    }

    if (target_margin_pct === undefined || target_margin_pct === null) {
      return NextResponse.json({ error: 'target_margin_pct is required' }, { status: 400 })
    }

    if (target_margin_pct < 0) {
      return NextResponse.json(
        { error: 'target_margin_pct must be non-negative' },
        { status: 400 }
      )
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
    const params: ActionParams['adjust_service_margin'] = {
      service_id,
      target_margin_pct,
      adjust_price,
    }

    // 6. Execute action via AIService
    // Use supabaseAdmin to bypass RLS since we've already verified membership
    const result = await aiService.execute('adjust_service_margin', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun: dry_run,
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
    console.error('[API] /api/actions/adjust-service-margin error:', error)
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
