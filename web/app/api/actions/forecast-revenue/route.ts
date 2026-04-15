/**
 * API Endpoint: Forecast Revenue Action
 *
 * Provides revenue projections based on historical data and trends.
 * Read-only action - does not modify data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { assertClinicAccess } from '@/lib/auth/verify-clinic-access'

const forecastRevenueSchema = z.object({
  days: z.coerce.number().int().positive().optional(),
  include_treatments: z.boolean().optional(),
  include_trends: z.boolean().optional(),
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
    const parsed = validateSchema(forecastRevenueSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { days, include_treatments, include_trends, clinic_id } = parsed.data    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied
    // 4. Build action parameters
    const params: ActionParams['forecast_revenue'] = {
      days,
      include_treatments,
      include_trends,
    }

    // 5. Execute action via AIService
    const result = await aiService.execute('forecast_revenue', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun: false, // Read-only action
    })

    // 6. Return result
    if (result.success) {
      return NextResponse.json({ success: true, data: result }, { status: 200 })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[API] /api/actions/forecast-revenue error:', error)
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
