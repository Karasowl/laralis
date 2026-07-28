import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withPermission } from '@/lib/middleware/with-permission'
import { listConvexDocumentsByClinic } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'


interface MarketingROIData {
  period: string // YYYY-MM format
  investmentCents: number
  revenueCents: number
  patientsCount: number
  roi: number
  avgRevenuePerPatientCents: number
}

type ImportedRecord = Record<string, any>

function normalizeConvexRecord(row: ImportedRecord) {
  const { _id, _creationTime, legacyId, legacyTable, convex_created_at, convex_updated_at, convex_snapshot_source, ...rest } = row
  return rest
}

/**
 * Replicates the Supabase marketing ROI aggregation against the Convex bridge.
 *
 * The original Supabase query applies, per source table:
 *  - expenses: clinic_id, expense_date in [startDate..endDate] (date-only YYYY-MM-DD),
 *      category ILIKE '%marketing%' AND (category ILIKE '%publicidad%' OR category ILIKE '%advertising%')
 *  - treatments: clinic_id, status === 'completed', treatment_date in [startDate..endDate] (date-only)
 *  - patients: clinic_id, created_at in [startTimestamp..endTimestamp] (full ISO)
 *
 * Convex has no joins; the three tables are aggregated independently into monthly buckets,
 * exactly mirroring the JS aggregation in the Supabase branch.
 */
async function getMarketingROIFromConvex(
  clinicId: string,
  startDateOnly: string,
  endDateOnly: string,
  startTimestamp: string,
  endTimestamp: string
) {
  const [expenses, treatments, patients] = await Promise.all([
    listConvexDocumentsByClinic('expenses', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  const matchesMarketingCategory = (category: unknown) => {
    const value = String(category ?? '').toLowerCase()
    return (
      value.includes('marketing') &&
      (value.includes('publicidad') || value.includes('advertising'))
    )
  }

  const filteredExpenses = expenses
    .map(normalizeConvexRecord)
    .filter((row) => {
      const date = String(row.expense_date ?? '')
      if (!date) return false
      if (date < startDateOnly || date > endDateOnly) return false
      return matchesMarketingCategory(row.category)
    })

  const filteredTreatments = treatments
    .map(normalizeConvexRecord)
    .filter((row) => {
      if (row.status !== 'completed') return false
      const date = String(row.treatment_date ?? '')
      if (!date) return false
      return date >= startDateOnly && date <= endDateOnly
    })

  const filteredPatients = patients
    .map(normalizeConvexRecord)
    .filter((row) => {
      const createdAt = String(row.created_at ?? '')
      if (!createdAt) return false
      return createdAt >= startTimestamp && createdAt <= endTimestamp
    })

  return { expenses: filteredExpenses, treatments: filteredTreatments, patients: filteredPatients }
}

export const GET = withPermission('campaigns.view', async (request: NextRequest, context) => {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const clinicId = context.clinicId
    const months = parseInt(searchParams.get('months') || '6')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    let expenses: Array<{ expense_date: string; amount_cents: number; category?: string | null }> | null
    let treatments: Array<{ treatment_date: string; price_cents: number; status?: string | null }> | null
    let patients: Array<{ created_at: string }> | null

    // clinicId comes from withPermission('campaigns.view'); context.clinicId is already
    // verified for the authenticated user, so the Convex bridge needs no extra clinic guard.
    if (shouldReturnConvexData('expenses')) {
      const convexData = await getMarketingROIFromConvex(
        clinicId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        startDate.toISOString(),
        endDate.toISOString()
      )
      expenses = convexData.expenses as typeof expenses
      treatments = convexData.treatments as typeof treatments
      patients = convexData.patients as typeof patients
    } else {
      // 1. Get marketing expenses by month
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('expense_date, amount_cents, category')
        .eq('clinic_id', clinicId)
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0])
        .ilike('category', '%marketing%')
        .or('category.ilike.%publicidad%,category.ilike.%advertising%')

      if (expensesError) {
        console.error('Error fetching expenses:', expensesError)
        return NextResponse.json({ error: expensesError.message }, { status: 500 })
      }

      // 2. Get completed treatments by month
      const { data: treatmentsData, error: treatmentsError } = await supabase
        .from('treatments')
        .select('treatment_date, price_cents, status')
        .eq('clinic_id', clinicId)
        .eq('status', 'completed')
        .gte('treatment_date', startDate.toISOString().split('T')[0])
        .lte('treatment_date', endDate.toISOString().split('T')[0])

      if (treatmentsError) {
        console.error('Error fetching treatments:', treatmentsError)
        return NextResponse.json({ error: treatmentsError.message }, { status: 500 })
      }

      // 3. Get new patients by month
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('created_at')
        .eq('clinic_id', clinicId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (patientsError) {
        console.error('Error fetching patients:', patientsError)
        return NextResponse.json({ error: patientsError.message }, { status: 500 })
      }

      expenses = expensesData
      treatments = treatmentsData
      patients = patientsData
    }

    // Group data by month
    const monthlyData = new Map<string, MarketingROIData>()

    // Process expenses
    expenses?.forEach((expense) => {
      const period = expense.expense_date.substring(0, 7) // YYYY-MM
      if (!monthlyData.has(period)) {
        monthlyData.set(period, {
          period,
          investmentCents: 0,
          revenueCents: 0,
          patientsCount: 0,
          roi: 0,
          avgRevenuePerPatientCents: 0
        })
      }
      const data = monthlyData.get(period)!
      data.investmentCents += expense.amount_cents || 0
    })

    // Process treatments
    treatments?.forEach((treatment) => {
      const period = treatment.treatment_date.substring(0, 7) // YYYY-MM
      if (!monthlyData.has(period)) {
        monthlyData.set(period, {
          period,
          investmentCents: 0,
          revenueCents: 0,
          patientsCount: 0,
          roi: 0,
          avgRevenuePerPatientCents: 0
        })
      }
      const data = monthlyData.get(period)!
      data.revenueCents += treatment.price_cents || 0
    })

    // Process patients
    patients?.forEach((patient) => {
      const period = patient.created_at.substring(0, 7) // YYYY-MM
      if (!monthlyData.has(period)) {
        monthlyData.set(period, {
          period,
          investmentCents: 0,
          revenueCents: 0,
          patientsCount: 0,
          roi: 0,
          avgRevenuePerPatientCents: 0
        })
      }
      const data = monthlyData.get(period)!
      data.patientsCount += 1
    })

    // Calculate ROI and averages
    const result: MarketingROIData[] = []
    monthlyData.forEach((data) => {
      if (data.investmentCents > 0) {
        data.roi = ((data.revenueCents - data.investmentCents) / data.investmentCents) * 100
      }
      if (data.patientsCount > 0) {
        data.avgRevenuePerPatientCents = Math.round(data.revenueCents / data.patientsCount)
      }
      result.push(data)
    })

    // Sort by period descending
    result.sort((a, b) => b.period.localeCompare(a.period))

    // Calculate totals
    const totals = result.reduce(
      (acc, curr) => ({
        totalInvestment: acc.totalInvestment + curr.investmentCents,
        totalRevenue: acc.totalRevenue + curr.revenueCents,
        totalPatients: acc.totalPatients + curr.patientsCount
      }),
      { totalInvestment: 0, totalRevenue: 0, totalPatients: 0 }
    )

    const overallROI = totals.totalInvestment > 0
      ? ((totals.totalRevenue - totals.totalInvestment) / totals.totalInvestment) * 100
      : 0

    const avgRevenuePerPatient = totals.totalPatients > 0
      ? Math.round(totals.totalRevenue / totals.totalPatients)
      : 0

    return NextResponse.json({
      periods: result,
      summary: {
        totalInvestmentCents: totals.totalInvestment,
        totalRevenueCents: totals.totalRevenue,
        totalPatients: totals.totalPatients,
        overallROI: Math.round(overallROI * 10) / 10,
        avgRevenuePerPatientCents: avgRevenuePerPatient,
        avgInvestmentPerPatientCents: totals.totalPatients > 0
          ? Math.round(totals.totalInvestment / totals.totalPatients)
          : 0
      }
    })
  } catch (error) {
    console.error('Error in marketing ROI API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
