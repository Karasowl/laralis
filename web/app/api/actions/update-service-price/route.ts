/**
 * API Endpoint: Update Service Price Action
 *
 * Allows Lara (or user) to update a service's price through the Actions System.
 * Supports dry-run mode for simulation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

const updateServicePriceSchema = z.object({
  service_id: z.string().uuid(),
  new_price_cents: z.coerce.number().int().positive(),
  reason: z.string().optional(),
  clinic_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
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
    const parsed = validateSchema(updateServicePriceSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { service_id, new_price_cents, reason, clinic_id, dry_run } = parsed.data
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
    const params: ActionParams['update_service_price'] = {
      service_id,
      new_price_cents,
      reason,
    }

    // 6. Execute action via AIService
    // Use supabaseAdmin to bypass RLS since we've already verified membership
    const result = await aiService.execute('update_service_price', params, {
      clinicId: clinic_id,
      userId: user.id,
      supabase: supabaseAdmin,
      dryRun,
    })

    // 7. Return result
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          data: result,
        },
        { status: dry_run ? 200 : 200 }
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
    console.error('[API] /api/actions/update-service-price error:', error)
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
