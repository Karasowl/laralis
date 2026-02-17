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
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

const updateTimeSettingsSchema = z.object({
  work_days: z.coerce.number().int().positive().optional(),
  hours_per_day: z.coerce.number().positive().optional(),
  real_productivity_pct: z.coerce.number().min(0).max(100).optional(),
  clinic_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
}).refine(
  (data) =>
    data.work_days !== undefined ||
    data.hours_per_day !== undefined ||
    data.real_productivity_pct !== undefined,
  {
    message: 'At least one setting (work_days, hours_per_day, or real_productivity_pct) is required',
  }
)

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

    // 2. Parse and validate request body
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(updateTimeSettingsSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { work_days, hours_per_day, real_productivity_pct, clinic_id, dry_run } = parsed.data
    const dryRun = dry_run ?? false

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
      dryRun,
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
