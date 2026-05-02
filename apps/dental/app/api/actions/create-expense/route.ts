/**
 * API Endpoint: Create Expense Action
 *
 * Allows Lara (or user) to create expenses through voice commands.
 * Supports dry-run mode for preview.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { aiService } from '@/lib/ai/service'
import type { ActionParams } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { assertClinicAccess } from '@/lib/auth/verify-clinic-access'

const createExpenseSchema = z.object({
  amount_cents: z.coerce.number().int().positive(),
  category_id: z.string().uuid(),
  description: z.string().min(1),
  expense_date: z.string().min(1),
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
    const parsed = validateSchema(createExpenseSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const { amount_cents, category_id, description, expense_date, clinic_id, dry_run } = parsed.data
    const dryRun = dry_run ?? false    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied
    // 5. Build action parameters
    const params: ActionParams['create_expense'] = {
      amount_cents,
      category_id,
      description,
      expense_date,
    }

    // 6. Execute action via AIService
    const result = await aiService.execute('create_expense', params, {
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
    console.error('[API] /api/actions/create-expense error:', error)
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
