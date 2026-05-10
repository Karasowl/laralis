/**
 * Analytics: Expenses
 *
 * GET /api/analytics/expenses
 * Returns expense breakdown by category and time period
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withPermission('expenses.view', async (request, context) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('category_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const clinicId = context.clinicId

    // Build query
    let query = supabaseAdmin
      .from('expenses')
      .select('expense_date, category, subcategory, amount_cents, description')
      .eq('clinic_id', clinicId)

    if (categoryId) {
      query = query.eq('category', categoryId)
    }
    if (startDate) {
      query = query.gte('expense_date', startDate)
    }
    if (endDate) {
      query = query.lte('expense_date', endDate)
    }

    const { data: expenses, error } = await query

    if (error) {
      throw error
    }

    // Calculate totals
    const totalExpensesCents = expenses?.reduce(
      (sum, e) => sum + (e.amount_cents || 0),
      0
    ) || 0

    // Group by category
    const expensesByCategory = expenses?.reduce(
      (acc, expense) => {
        const cat = expense.category || 'Unknown'
        if (!acc[cat]) {
          acc[cat] = {
            category: cat,
            total_cents: 0,
            count: 0,
          }
        }
        acc[cat].total_cents += expense.amount_cents || 0
        acc[cat].count += 1
        return acc
      },
      {} as Record<string, { category: string; total_cents: number; count: number }>
    )

    // Convert to array and sort
    const categoryArray = Object.values(expensesByCategory || {}).sort(
      (a, b) => b.total_cents - a.total_cents
    )

    return NextResponse.json({
      total_expenses_cents: totalExpensesCents,
      expenses_by_category: categoryArray,
      period: {
        start: startDate || null,
        end: endDate || null,
      },
      expenses_count: expenses?.length || 0,
    })
  } catch (error) {
    console.error('[API /analytics/expenses] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch expense data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
