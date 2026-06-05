import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import { calculateCAC } from '@/lib/calc/marketing'
import { buildBuckets, chooseGranularity, findBucketKey } from '@/lib/calc/buckets'
import { getFirstTreatmentDateByPatient } from '@/lib/calc/patient-acquisition'
import { listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, ...rest } = row
  return rest
}

/**
 * Replicates getFirstTreatmentDateByPatient (lib/calc/patient-acquisition.ts)
 * over Convex treatment rows. Same filters as the Supabase query
 * (treatment_date NOT NULL, status != 'cancelled') and the same
 * "earliest lexicographic ISO date wins" reduction, so the bucketed
 * new-patient counts match the Supabase path byte-for-byte.
 */
function buildFirstTreatmentDateMapFromConvex(
  treatments: ImportedRecord[]
): Map<string, string> {
  const firstDate = new Map<string, string>()

  for (const t of treatments) {
    if (t.treatment_date === null || t.treatment_date === undefined) continue
    if (t.status == null || t.status === 'cancelled') continue

    const pid = String(t.patient_id ?? '')
    if (!pid) continue

    const iso = String(t.treatment_date || '').slice(0, 10)
    if (!iso) continue

    const existing = firstDate.get(pid)
    if (!existing || iso < existing) firstDate.set(pid, iso)
  }

  return firstDate
}

/**
 * Convex read path. Fetches the SAME tables the Supabase branch reads
 * (categories, expenses, treatments) via the migration bridge and replicates
 * the identical in-memory aggregation: marketing-category lookup by name,
 * expense filtering by category + lexicographic [start, end] date range,
 * first-treatment-per-patient bucketing, and the shared calculateCAC. Convex
 * has no relational joins, so the expense → category and treatment → patient
 * foreign keys are matched in JS. Money stays in integer cents.
 */
async function getCacTrendFromConvex(
  clinicId: string,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<{
  marketingExpenses: Array<{ amount_cents: number; expense_date: string }>
  firstTreatmentDate: Map<string, string>
}> {
  // Marketing categories are global (no clinic filter), matching the Supabase
  // `.from('categories').eq('name', 'marketing')` query.
  const categories = await listConvexTable('categories', 10000) as ImportedRecord[]
  const marketingCategoryIdSet = new Set(
    (categories || [])
      .filter((c) => c.name === 'marketing')
      .map((c) => String(c.id))
  )

  // Fetch clinic expenses + treatments once.
  const [expensesRaw, treatmentsRaw] = await Promise.all([
    listConvexDocumentsByClinic('expenses', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  // Marketing expenses inside the inclusive [rangeStartIso, rangeEndIso] range.
  // Mirrors the Supabase `.in('category_id', ids).gte().lte()` filter.
  let marketingExpenses: Array<{ amount_cents: number; expense_date: string }> = []
  if (marketingCategoryIdSet.size > 0) {
    marketingExpenses = (expensesRaw || [])
      .filter((e) => {
        if (!marketingCategoryIdSet.has(String(e.category_id))) return false
        const d = String(e.expense_date || '').slice(0, 10)
        return d >= rangeStartIso && d <= rangeEndIso
      })
      .map((e) => {
        const row = normalizeConvexRecord(e)
        return { amount_cents: row.amount_cents, expense_date: row.expense_date }
      })
  }

  const firstTreatmentDate = buildFirstTreatmentDateMapFromConvex(treatmentsRaw || [])

  return { marketingExpenses, firstTreatmentDate }
}

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

    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.view')
    if (forbidden) return forbidden

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

    // Resolve the data source. Both branches produce the SAME two inputs
    // (range-filtered marketing expenses + a patientId -> first-treatment-ISO
    // map); the downstream bucketing / calculateCAC aggregation is identical
    // regardless of source, so the response shape and numbers match exactly.
    let marketingExpenses: Array<{ amount_cents: number; expense_date: string }> = []
    let firstTreatmentDate: Map<string, string>

    if (shouldReturnConvexData('expenses')) {
      const convexData = await getCacTrendFromConvex(clinicId, rangeStartIso, rangeEndIso)
      marketingExpenses = convexData.marketingExpenses
      firstTreatmentDate = convexData.firstTreatmentDate
    } else {
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
      firstTreatmentDate = await getFirstTreatmentDateByPatient(clinicId)
    }

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
