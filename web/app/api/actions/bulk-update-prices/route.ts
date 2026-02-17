/**
 * API Endpoint: Bulk Update Prices Action
 *
 * Allows Lara (or user) to update multiple service prices at once.
 * Supports percentage or fixed amount changes.
 * Supports dry-run mode for preview.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

const bulkUpdatePricesSchema = z.object({
  change_type: z.enum(['percentage', 'fixed']),
  change_value: z.coerce.number(),
  service_ids: z.array(z.string().uuid()).optional(),
  category: z.string().min(1).optional(),
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
    const parsed = validateSchema(bulkUpdatePricesSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { change_type, change_value, service_ids, category, clinic_id, dry_run } = parsed.data
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
    const params: ActionParams['bulk_update_prices'] = {
      change_type,
      change_value,
      service_ids,
      category,
    }

    // 6. Execute action via AIService
    const result = await aiService.execute('bulk_update_prices', params, {
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
    console.error('[API] /api/actions/bulk-update-prices error:', error)
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
