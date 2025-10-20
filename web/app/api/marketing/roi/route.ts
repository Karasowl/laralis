import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface MarketingROIData {
  period: string // YYYY-MM format
  investmentCents: number
  revenueCents: number
  patientsCount: number
  roi: number
  avgRevenuePerPatientCents: number
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')
    const months = parseInt(searchParams.get('months') || '6')

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // 1. Get marketing expenses by month
    const { data: expenses, error: expensesError } = await supabase
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
    const { data: treatments, error: treatmentsError } = await supabase
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
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (patientsError) {
      console.error('Error fetching patients:', patientsError)
      return NextResponse.json({ error: patientsError.message }, { status: 500 })
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
      data.investmentCents += expense.amount_cents
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
      data.revenueCents += treatment.price_cents
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
}
