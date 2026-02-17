import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { withRouteContext } from '@/lib/api/route-handler'
import { createRouteLogger } from '@/lib/api/logger'

export const dynamic = 'force-dynamic'


interface StatsByCategory {
  category: string
  amount: number
  count: number
  percentage: number
}

interface StatsByMonth {
  month: string
  amount: number
  count: number
}

export const GET = withPermission('expenses.view', async (request, context) =>
  withRouteContext(request, async ({ requestId }) => {
    const logger = createRouteLogger(requestId)
    try {
      const { searchParams } = new URL(request.url)
      const clinicId = context.clinicId
      const startDate = searchParams.get('start_date')
      const endDate = searchParams.get('end_date')

      // Build expenses query within date range
      let q = supabaseAdmin
        .from('expenses')
        .select('expense_date, category, amount_cents, is_variable')
        .eq('clinic_id', clinicId)

      if (startDate) q = q.gte('expense_date', startDate)
      if (endDate) q = q.lte('expense_date', endDate)

      const { data: expenses, error } = await q
      if (error) {
        logger.error('expenses.stats.fetch_expenses_failed', { error: error.message })
        return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
      }

      const totalCents = (expenses || []).reduce((sum, e) => sum + (e.amount_cents || 0), 0)
      const totalCount = expenses?.length || 0

      // Group by category
      const byCategoryMap = new Map<string, { amount: number; count: number }>()
      for (const e of expenses || []) {
        const cat = e.category || 'Otros'
        const prev = byCategoryMap.get(cat) || { amount: 0, count: 0 }
        prev.amount += e.amount_cents || 0
        prev.count += 1
        byCategoryMap.set(cat, prev)
      }

      const byCategory: StatsByCategory[] = Array.from(byCategoryMap.entries())
        .map(([category, v]) => ({
          category,
          amount: Math.round(v.amount),
          count: v.count,
          percentage: totalCents > 0 ? Math.round((v.amount / totalCents) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount)

      // Group by month (YYYY-MM)
      const byMonthMap = new Map<string, { amount: number; count: number }>()
      for (const e of expenses || []) {
        const month = (e.expense_date || '').toString().slice(0, 7) // YYYY-MM
        const prev = byMonthMap.get(month) || { amount: 0, count: 0 }
        prev.amount += e.amount_cents || 0
        prev.count += 1
        byMonthMap.set(month, prev)
      }
      const by_month: StatsByMonth[] = Array.from(byMonthMap.entries())
        .map(([month, v]) => ({ month, amount: Math.round(v.amount), count: v.count }))
        .sort((a, b) => a.month.localeCompare(b.month))

      // Planned (fixed costs for clinic)
      const { data: fixedCosts, error: fcError } = await supabaseAdmin
        .from('fixed_costs')
        .select('amount_cents')
        .eq('clinic_id', clinicId)
      if (fcError) {
        logger.warn('expenses.stats.fixed_costs_fetch_warning', { error: fcError.message })
      }
      const plannedCents = (fixedCosts || []).reduce((sum, f) => sum + (f.amount_cents || 0), 0)

      // CRITICAL: Only compare FIXED expenses against planned fixed costs
      // Variable expenses are excluded because they are tied to treatments.
      const fixedExpensesCents = (expenses || [])
        .filter(e => !e.is_variable)
        .reduce((sum, e) => sum + (e.amount_cents || 0), 0)

      const varianceCents = fixedExpensesCents - plannedCents
      const variancePct = plannedCents > 0 ? (varianceCents / plannedCents) * 100 : 0

      return NextResponse.json({
        data: {
          total_amount: Math.round(totalCents),
          total_count: totalCount,
          by_category: byCategory.map(c => ({
            category: c.category,
            amount: Math.round(c.amount),
            count: c.count,
            percentage: c.percentage,
          })),
          by_month,
          vs_fixed_costs: {
            planned: Math.round(plannedCents),
            actual: Math.round(fixedExpensesCents),
            variance: Math.round(varianceCents),
            variance_percentage: Math.round(variancePct),
          },
        },
      })
    } catch (error) {
      logger.error('expenses.stats.unexpected_error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
)

