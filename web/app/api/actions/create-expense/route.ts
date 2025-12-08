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
    const { amount_cents, category_id, description, expense_date, clinic_id, dry_run = false } = body

    // 3. Validate required parameters
    if (!amount_cents || amount_cents <= 0) {
      return NextResponse.json(
        { error: 'amount_cents is required and must be positive' },
        { status: 400 }
      )
    }

    if (!category_id) {
      return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
    }

    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    if (!expense_date) {
      return NextResponse.json({ error: 'expense_date is required' }, { status: 400 })
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
      dryRun: dry_run,
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
