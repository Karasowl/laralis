/**
 * API Endpoint: Compare Periods Action
 *
 * Compares metrics between two specific time periods.
 * Read-only action - does not modify data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

const comparePeriodsSchema = z.object({
  period1_start: z.string().min(1),
  period1_end: z.string().min(1),
  period2_start: z.string().min(1),
  period2_end: z.string().min(1),
  metrics: z.array(z.enum(['revenue', 'expenses', 'treatments', 'patients'])).optional(),
  clinic_id: z.string().uuid(),
})

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
    const parsed = validateSchema(comparePeriodsSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { period1_start, period1_end, period2_start, period2_end, metrics, clinic_id } = parsed.data

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
    const params: ActionParams['compare_periods'] = {
      period1_start,
      period1_end,
      period2_start,
      period2_end,
      metrics,
    }

    // 6. Execute action via AIService
    const result = await aiService.execute('compare_periods', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun: false, // Read-only action
    })

    // 7. Return result
    if (result.success) {
      return NextResponse.json({ success: true, data: result }, { status: 200 })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[API] /api/actions/compare-periods error:', error)
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
