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
import type { ActionParams, ActionResult } from '@/lib/ai/types'
import { z } from 'zod'
import { readJson, validateSchema } from '@/lib/validation'
import { assertClinicAccess } from '@/lib/auth/verify-clinic-access'
import { forbiddenIfMissingPermissions } from '@/lib/permissions'
import { shouldReturnConvexData } from '@/lib/data-backend'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'

const comparePeriodsSchema = z.object({
  period1_start: z.string().min(1),
  period1_end: z.string().min(1),
  period2_start: z.string().min(1),
  period2_end: z.string().min(1),
  metrics: z.array(z.enum(['revenue', 'expenses', 'treatments', 'patients'])).optional(),
  clinic_id: z.string().uuid(),
})

type ConvexRow = Record<string, any>

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Convex-only replication of executeComparePeriods (lib/ai/actions/analytics-actions.ts).
 *
 * In DATA_READ_BACKEND=convex Supabase is unreachable, so aiService.execute ->
 * executeComparePeriods would throw on its first supabaseAdmin.from() read. This
 * mirrors that action's reads against Convex and rebuilds a byte-equivalent
 * ActionResult so the route's response payload matches the Supabase path.
 *
 * Date filtering replicates the action's inclusive bounds:
 *   treatments: treatment_date BETWEEN periodN_start AND periodN_end
 *   expenses:   expense_date  BETWEEN periodN_start AND periodN_end
 *   patients:   created_at    BETWEEN periodN_start AND periodN_end
 * The action passes the raw period strings to .gte()/.lte(); Postgres compares them
 * against ISO-8601 date/timestamp columns, which is order-equivalent to the string
 * comparison used here for ISO-formatted bounds (same convention as the reference
 * convex read route dashboard/patients).
 */
async function comparePeriodsInConvex(
  params: ActionParams['compare_periods'],
  ctx: { clinicId: string; userId: string }
): Promise<ActionResult> {
  const { clinicId, userId } = ctx
  const {
    period1_start,
    period1_end,
    period2_start,
    period2_end,
    metrics = ['revenue', 'expenses', 'treatments', 'patients'],
  } = params

  try {
    const [allTreatments, allExpenses, allPatients] = await Promise.all([
      listConvexDocumentsByClinic('treatments', clinicId) as Promise<ConvexRow[]>,
      listConvexDocumentsByClinic('expenses', clinicId) as Promise<ConvexRow[]>,
      listConvexDocumentsByClinic('patients', clinicId) as Promise<ConvexRow[]>,
    ])

    const inRange = (value: unknown, start: string, end: string): boolean => {
      const v = String(value ?? '')
      return v !== '' && v >= start && v <= end
    }

    const treatments1 = allTreatments.filter((t) =>
      inRange(t.treatment_date, period1_start, period1_end)
    )
    const treatments2 = allTreatments.filter((t) =>
      inRange(t.treatment_date, period2_start, period2_end)
    )
    const expenses1 = allExpenses.filter((e) =>
      inRange(e.expense_date, period1_start, period1_end)
    )
    const expenses2 = allExpenses.filter((e) =>
      inRange(e.expense_date, period2_start, period2_end)
    )
    const patients1 = allPatients.filter((p) =>
      inRange(p.created_at, period1_start, period1_end)
    )
    const patients2 = allPatients.filter((p) =>
      inRange(p.created_at, period2_start, period2_end)
    )

    const comparison: Record<
      string,
      { period1: number; period2: number; change: number; changePct: number }
    > = {}

    if (metrics.includes('revenue')) {
      const rev1 = treatments1.reduce((sum, t) => sum + (Number(t.price_cents) || 0), 0)
      const rev2 = treatments2.reduce((sum, t) => sum + (Number(t.price_cents) || 0), 0)
      comparison.revenue = {
        period1: rev1,
        period2: rev2,
        change: rev2 - rev1,
        changePct: rev1 > 0 ? ((rev2 - rev1) / rev1) * 100 : 0,
      }
    }

    if (metrics.includes('expenses')) {
      const exp1 = expenses1.reduce((sum, e) => sum + (Number(e.amount_cents) || 0), 0)
      const exp2 = expenses2.reduce((sum, e) => sum + (Number(e.amount_cents) || 0), 0)
      comparison.expenses = {
        period1: exp1,
        period2: exp2,
        change: exp2 - exp1,
        changePct: exp1 > 0 ? ((exp2 - exp1) / exp1) * 100 : 0,
      }
    }

    if (metrics.includes('treatments')) {
      const count1 = treatments1.length
      const count2 = treatments2.length
      comparison.treatments = {
        period1: count1,
        period2: count2,
        change: count2 - count1,
        changePct: count1 > 0 ? ((count2 - count1) / count1) * 100 : 0,
      }
    }

    if (metrics.includes('patients')) {
      const pat1 = patients1.length
      const pat2 = patients2.length
      comparison.patients = {
        period1: pat1,
        period2: pat2,
        change: pat2 - pat1,
        changePct: pat1 > 0 ? ((pat2 - pat1) / pat1) * 100 : 0,
      }
    }

    const changes = [
      `📊 Period Comparison`,
      `Period 1: ${period1_start} to ${period1_end}`,
      `Period 2: ${period2_start} to ${period2_end}`,
      '',
    ]

    Object.entries(comparison).forEach(([metric, data]) => {
      const icon = data.changePct > 0 ? '📈' : data.changePct < 0 ? '📉' : '➖'
      const format =
        metric === 'revenue' || metric === 'expenses'
          ? formatCurrency
          : (v: number) => v.toString()
      changes.push(
        `**${metric.charAt(0).toUpperCase() + metric.slice(1)}** ${icon}`,
        `  Period 1: ${format(data.period1)} → Period 2: ${format(data.period2)}`,
        `  Change: ${data.change > 0 ? '+' : ''}${format(data.change)} (${data.changePct > 0 ? '+' : ''}${data.changePct.toFixed(1)}%)`,
        ''
      )
    })

    return {
      success: true,
      action: 'compare_periods',
      params,
      result: { changes, comparison },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'compare_periods',
      params,
      error: { code: 'EXECUTION_ERROR', message: error?.message || 'Unknown error occurred' },
      executed_at: new Date().toISOString(),
      executed_by: userId,
    }
  }
}

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
    const { period1_start, period1_end, period2_start, period2_end, metrics, clinic_id } = parsed.data    // Verify user has access to the clinic (uses user_has_clinic_access RPC).
    const accessDenied = await assertClinicAccess(user.id, clinic_id, supabase)
    if (accessDenied) return accessDenied

    const forbidden = await forbiddenIfMissingPermissions(user.id, clinic_id, [
      'lara.use_query_mode',
      'financial_reports.view',
    ])
    if (forbidden) return forbidden

    // 5. Build action parameters
    const params: ActionParams['compare_periods'] = {
      period1_start,
      period1_end,
      period2_start,
      period2_end,
      metrics,
    }

    // 6. Execute action.
    // Convex-only read path: replicate the action's reads directly, since the
    // supabaseAdmin reads inside executeComparePeriods are unreachable in this mode.
    let result
    if (shouldReturnConvexData('treatments')) {
      result = await comparePeriodsInConvex(params, {
        clinicId: clinic_id,
        userId: user.id,
      })
    } else {
      // Execute action via AIService (Supabase path).
      result = await aiService.execute('compare_periods', params, {
        clinicId: clinic_id,
        userId: user.id,
        supabase: supabaseAdmin,
        dryRun: false, // Read-only action
      })
    }

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
