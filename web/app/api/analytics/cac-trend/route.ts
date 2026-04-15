import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calculateCAC } from '@/lib/calc/marketing'
import { buildBuckets, chooseGranularity, findBucketKey } from '@/lib/calc/buckets'
import { getFirstTreatmentDateByPatient } from '@/lib/calc/patient-acquisition'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/cac-trend
 *
 * Customer Acquisition Cost evolution over time, with adaptive bucketing:
 *   <= 45 days  -> daily
 *   <= 365 days -> weekly
 *   >  365 days -> monthly
 *
 * Response shape preserved (`trend: [{ month, period, cacCents, ... }]`)
 * so existing chart consumers don't need to change. The `month` field is
 * just the bucket label and may now be a day or week label depending on
 * the selected range.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams

    const ctx = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in ctx) {
      return NextResponse.json(
        { error: ctx.error.message },
        { status: ctx.error.status }
      )
    }

    const { clinicId } = ctx
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const months = parseInt(searchParams.get('months') || '12', 10)

    let rangeStart: Date
    let rangeEnd: Date

    if (startDateParam && endDateParam) {
      rangeStart = new Date(startDateParam)
      rangeEnd = new Date(endDateParam)
    } else {
      rangeEnd = new Date()
      rangeStart = new Date()
      rangeStart.setMonth(rangeStart.getMonth() - months)
    }

    const granularity = chooseGranularity(rangeStart, rangeEnd)
    const buckets = buildBuckets(rangeStart, rangeEnd, granularity)

    if (buckets.length === 0) {
      return NextResponse.json({
        granularity,
        months: 0,
        trend: [],
        summary: {
          currentCACCents: 0,
          averageCACCents: 0,
          lowestCACCents: null,
          highestCACCents: 0,
        },
      })
    }

    const rangeStartIso = buckets[0].start
    const rangeEndIso = buckets[buckets.length - 1].end

    // Fetch marketing expenses + patients in the entire range, then bucket
    // them in-memory. Replaces the previous PostgREST `categories!inner`
    // join (which was unreliable in production) with a two-step lookup.
    const { data: marketingCategories, error: marketingCatError } =
      await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('name', 'marketing')

    if (marketingCatError) {
      console.error('[cac-trend] Error fetching marketing category:', marketingCatError)
    }

    const marketingCategoryIds = (marketingCategories || []).map((c: any) => c.id)

    let marketingExpenses: Array<{ amount_cents: number; expense_date: string }> = []
    if (marketingCategoryIds.length > 0) {
      const { data: expenses, error: expensesError } = await supabaseAdmin
        .from('expenses')
        .select('amount_cents, expense_date')
        .eq('clinic_id', clinicId)
        .in('category_id', marketingCategoryIds)
        .gte('expense_date', rangeStartIso)
        .lte('expense_date', rangeEndIso)

      if (expensesError) {
        console.error('[cac-trend] Error fetching expenses:', expensesError)
        throw expensesError
      }
      marketingExpenses = (expenses || []) as any
    }

    // "New patient" = patient whose FIRST treatment falls in the bucket.
    // patients.created_at is the lead-capture date and over-counts contacts
    // who never converted into actual visits.
    const firstTreatmentDate = await getFirstTreatmentDateByPatient(clinicId)

    // Bucket aggregations.
    const expensesByBucket = new Map<string, number>()
    const patientsByBucket = new Map<string, number>()
    buckets.forEach(b => {
      expensesByBucket.set(b.key, 0)
      patientsByBucket.set(b.key, 0)
    })

    marketingExpenses.forEach(e => {
      const iso = (e.expense_date as string).slice(0, 10)
      const key = findBucketKey(buckets, iso)
      if (key) {
        expensesByBucket.set(key, (expensesByBucket.get(key) || 0) + (e.amount_cents || 0))
      }
    })

    firstTreatmentDate.forEach((iso) => {
      const key = findBucketKey(buckets, iso)
      if (key) {
        patientsByBucket.set(key, (patientsByBucket.get(key) || 0) + 1)
      }
    })

    const trend = buckets.map(b => {
      const expensesCents = expensesByBucket.get(b.key) || 0
      const newPatients = patientsByBucket.get(b.key) || 0
      const cacCents = calculateCAC(expensesCents, newPatients)
      return {
        month: b.label, // chart x-axis
        period: b.start,
        cacCents,
        expensesCents,
        newPatients,
      }
    })

    // Average CAC over buckets that actually had activity (avoids dragging
    // the average down to zero when most buckets are empty in a wide range).
    const activeBuckets = trend.filter(t => t.expensesCents > 0 || t.newPatients > 0)
    const avgCAC = activeBuckets.length > 0
      ? Math.round(
          activeBuckets.reduce((sum, t) => sum + t.cacCents, 0) / activeBuckets.length
        )
      : 0

    const currentCAC = trend[trend.length - 1]?.cacCents || 0
    const positiveCacs = trend.map(t => t.cacCents).filter(c => c > 0)

    return NextResponse.json({
      granularity,
      months: buckets.length,
      trend,
      summary: {
        currentCACCents: currentCAC,
        averageCACCents: avgCAC,
        lowestCACCents: positiveCacs.length > 0 ? Math.min(...positiveCacs) : null,
        highestCACCents: trend.length > 0 ? Math.max(...trend.map(t => t.cacCents)) : 0,
      },
    })
  } catch (error: any) {
    // Log full error server-side; respond with a generic message so DB
    // schema details (column names, hints) don't leak to the client.
    console.error('[cac-trend] Error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: 'Failed to calculate CAC trend' },
      { status: 500 }
    )
  }
}
