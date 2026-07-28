/**
 * Analytics: Expenses
 *
 * GET /api/analytics/expenses
 * Returns expense breakdown by category and time period
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

type ExpenseAnalyticsRow = {
  expense_date: string | null
  category: string | null
  subcategory: string | null
  amount_cents: number | null
  description: string | null
}

/**
 * Replicates the Supabase expense-analytics read path in JS using Convex as the
 * data source. Mirrors EXACTLY:
 *  - select columns (expense_date, category, subcategory, amount_cents, description)
 *  - filters: clinic_id (via listByClinic), category === category_id (param),
 *    expense_date >= start_date, expense_date <= end_date (YYYY-MM-DD lexicographic-safe)
 *  - aggregation: integer-cent sum, group-by-category with 'Unknown' fallback,
 *    descending sort by total_cents.
 */
async function getExpenseAnalyticsFromConvex(
  clinicId: string,
  categoryId: string | null,
  startDate: string | null,
  endDate: string | null
) {
  const rawRows = (await listConvexDocumentsByClinic('expenses', clinicId, 10000)) as ImportedRecord[]

  const expenses: ExpenseAnalyticsRow[] = rawRows
    .map(normalizeConvexRecord)
    .filter((row) => {
      // Mirror Supabase .eq('category', categoryId) — note the route filters the
      // `category` column by the `category_id` query param (kept identical here).
      if (categoryId && row.category !== categoryId) return false
      // expense_date is YYYY-MM-DD; lexicographic comparison matches Postgres date ordering.
      if (startDate && String(row.expense_date || '') < startDate) return false
      if (endDate && String(row.expense_date || '') > endDate) return false
      return true
    })
    .map((row) => ({
      expense_date: row.expense_date ?? null,
      category: row.category ?? null,
      subcategory: row.subcategory ?? null,
      amount_cents: row.amount_cents ?? null,
      description: row.description ?? null,
    }))

  return expenses
}

export const GET = withPermission('expenses.view', async (request, context) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('category_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const clinicId = context.clinicId

    if (shouldReturnConvexData('expenses')) {
      const expenses = await getExpenseAnalyticsFromConvex(clinicId, categoryId, startDate, endDate)

      // Calculate totals (integer cents only)
      const totalExpensesCents = expenses.reduce(
        (sum, e) => sum + (e.amount_cents || 0),
        0
      )

      // Group by category
      const expensesByCategory = expenses.reduce(
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
      const categoryArray = Object.values(expensesByCategory).sort(
        (a, b) => b.total_cents - a.total_cents
      )

      return NextResponse.json({
        total_expenses_cents: totalExpensesCents,
        expenses_by_category: categoryArray,
        period: {
          start: startDate || null,
          end: endDate || null,
        },
        expenses_count: expenses.length,
      })
    }

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
