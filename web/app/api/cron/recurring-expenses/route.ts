import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const recurringExpenseSchema = z.object({
  clinic_id: z.string().uuid(),
})

/**
 * Cron endpoint to process recurring expenses.
 * Creates new expense entries for recurring expenses that are due.
 *
 * Schedule: 0 1 * * * (daily at 00:01 UTC)
 * Vercel Cron will call this endpoint automatically.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require auth. In development, allow without.
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Call the database function to process all recurring expenses
    const { data, error } = await supabaseAdmin
      .rpc('process_recurring_expenses', { p_clinic_id: null })

    if (error) {
      console.error('[cron/recurring-expenses] Error processing:', error)
      return NextResponse.json({ error: 'Failed to process recurring expenses' }, { status: 500 })
    }

    const result = data?.[0] || { generated_count: 0, expense_ids: [] }
    console.info(`[cron/recurring-expenses] Generated ${result.generated_count} expense entries`)

    return NextResponse.json({
      success: true,
      generated: result.generated_count,
      expense_ids: result.expense_ids || []
    })
  } catch (error) {
    console.error('[cron/recurring-expenses] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST endpoint to manually trigger recurring expense processing for a specific clinic.
 * Useful for testing or manual intervention.
 */
export async function POST(request: NextRequest) {
  try {
    const bodyResult = await readJson(request)
    if ('error' in bodyResult) {
      return bodyResult.error
    }
    const parsed = validateSchema(recurringExpenseSchema, bodyResult.data)
    if ('error' in parsed) {
      return parsed.error
    }
    const clinicId = parsed.data.clinic_id

    // Call the database function for specific clinic
    const { data, error } = await supabaseAdmin
      .rpc('process_recurring_expenses', { p_clinic_id: clinicId })

    if (error) {
      console.error('[cron/recurring-expenses] Error processing for clinic:', error)
      return NextResponse.json({ error: 'Failed to process recurring expenses' }, { status: 500 })
    }

    const result = data?.[0] || { generated_count: 0, expense_ids: [] }

    return NextResponse.json({
      success: true,
      clinic_id: clinicId,
      generated: result.generated_count,
      expense_ids: result.expense_ids || []
    })
  } catch (error) {
    console.error('[cron/recurring-expenses] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
