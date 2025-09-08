import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    const clinicId = searchParams.get('clinic_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Require session like other endpoints
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'clinic_id is required' }, { status: 400 })
    }

    // Build expenses query within date range
    let q = supabase
      .from('expenses')
      .select('expense_date, category, amount_cents')
      .eq('clinic_id', clinicId)

    if (startDate) q = q.gte('expense_date', startDate)
    if (endDate) q = q.lte('expense_date', endDate)

    const { data: expenses, error } = await q
    if (error) {
      console.error('Error fetching expenses for stats:', error)
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
    const { data: fixedCosts, error: fcError } = await supabase
      .from('fixed_costs')
      .select('amount_cents')
      .eq('clinic_id', clinicId)
    if (fcError) {
      console.warn('Warning: failed fetching fixed_costs for stats:', fcError.message)
    }
    const plannedCents = (fixedCosts || []).reduce((sum, f) => sum + (f.amount_cents || 0), 0)

    const varianceCents = totalCents - plannedCents
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
          actual: Math.round(totalCents),
          variance: Math.round(varianceCents),
          variance_percentage: Math.round(variancePct),
        },
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/expenses/stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

