/**
 * API Endpoint: Update Time Settings Action
 *
 * Allows Lara (or user) to update clinic time/productivity settings.
 * Supports dry-run mode for preview.
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
    const { work_days, hours_per_day, real_productivity_pct, clinic_id, dry_run = false } = body

    // 3. Validate that at least one setting is provided
    if (work_days === undefined && hours_per_day === undefined && real_productivity_pct === undefined) {
      return NextResponse.json(
        { error: 'At least one setting (work_days, hours_per_day, or real_productivity_pct) is required' },
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
    const params: ActionParams['update_time_settings'] = {
      work_days,
      hours_per_day,
      real_productivity_pct,
    }

    // 6. Execute action via AIService
    const result = await aiService.execute('update_time_settings', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun: dry_run,
    })

    // 7. Return result
    if (result.success) {
      return NextResponse.json({ success: true, data: result }, { status: 200 })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[API] /api/actions/update-time-settings error:', error)
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
