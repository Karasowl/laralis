import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  calculateCAC,
  calculateLTV,
  calculateConversionRate,
  calculateLTVCACRatio,
  getLTVCACRatioQuality
} from '@/lib/calc/marketing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/marketing-metrics
 *
 * Calcula métricas clave de marketing:
 * - CAC (Customer Acquisition Cost)
 * - LTV (Lifetime Value)
 * - Conversion Rate
 * - LTV/CAC Ratio con clasificación
 *
 * Query params:
 * - clinicId: UUID (opcional, se obtiene del contexto)
 * - period: number (días, default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const searchParams = request.nextUrl.searchParams

    // Resolver contexto de clínica
    const ctx = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore
    })

    if ('error' in ctx) {
      return NextResponse.json(
        { error: ctx.error.message },
        { status: ctx.error.status }
      )
    }

    const { clinicId } = ctx

    // Parse date range - supports explicit dates or period lookback
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const period = parseInt(searchParams.get('period') || '30', 10)

    let startDate: Date
    let endDate: Date
    let startDateStr: string
    let endDateStr: string

    if (startDateParam && endDateParam) {
      // Use explicit date range
      startDateStr = startDateParam
      endDateStr = endDateParam
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
    } else {
      // Fall back to period lookback
      endDate = new Date()
      startDate = new Date()
      startDate.setDate(startDate.getDate() - period)
      startDateStr = startDate.toISOString().split('T')[0]
      endDateStr = endDate.toISOString().split('T')[0]
    }

    console.info('[marketing-metrics] Fetching for clinic:', clinicId)
    console.info('[marketing-metrics] Date range:', startDateStr, 'to', endDateStr)

    // 1. Obtener gastos de marketing del periodo
    const { data: marketingExpenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, category_id, categories!inner(name)')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)

    if (expensesError) {
      console.error('[marketing-metrics] Error fetching expenses:', expensesError)
      throw expensesError
    }

    // Filtrar solo gastos de marketing
    const marketingExpensesCents = (marketingExpenses || [])
      .filter((expense: any) => {
        const categoryName = expense.categories?.name
        return categoryName === 'marketing'
      })
      .reduce((sum: number, expense: any) => sum + (expense.amount_cents || 0), 0)

    console.info('[marketing-metrics] Marketing expenses:', marketingExpensesCents)

    // 2. Obtener pacientes nuevos del periodo
    const { data: newPatients, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('id, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (patientsError) {
      console.error('[marketing-metrics] Error fetching patients:', patientsError)
      throw patientsError
    }

    const newPatientsCount = newPatients?.length || 0
    console.info('[marketing-metrics] New patients:', newPatientsCount)

    // 2.1 Obtener leads del periodo (para conversion rate)
    const { data: leadsInPeriod, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, status, converted_patient_id')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (leadsError) {
      console.error('[marketing-metrics] Error fetching leads:', leadsError)
      throw leadsError
    }

    const totalLeads = leadsInPeriod?.length || 0
    const convertedLeads = (leadsInPeriod || []).filter(
      (lead: any) => lead.status === 'converted' || lead.converted_patient_id
    ).length

    // 3. Obtener TODOS los pacientes (para LTV)
    const { data: allPatients, error: allPatientsError } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)

    if (allPatientsError) {
      console.error('[marketing-metrics] Error fetching all patients:', allPatientsError)
      throw allPatientsError
    }

    const totalPatients = allPatients?.length || 0

    // 4. Obtener ingresos del periodo (treatments completados dentro del rango de fechas)
    // NOTE: LTV is calculated from period revenue for consistency with date filter
    const { data: completedTreatments, error: treatmentsError } = await supabaseAdmin
      .from('treatments')
      .select('price_cents, patient_id')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', startDateStr)
      .lte('treatment_date', endDateStr)

    if (treatmentsError) {
      console.error('[marketing-metrics] Error fetching treatments:', treatmentsError)
      throw treatmentsError
    }

    const totalRevenueCents = (completedTreatments || [])
      .reduce((sum: number, t: any) => sum + (t.price_cents || 0), 0)

    // 5. Calcular pacientes convertidos (con al menos 1 tratamiento)
    const uniquePatients = new Set(
      (completedTreatments || []).map((t: any) => t.patient_id)
    )
    const convertedPatients = uniquePatients.size

    console.info('[marketing-metrics] Total revenue:', totalRevenueCents)
    console.info('[marketing-metrics] Converted patients:', convertedPatients, '/', totalPatients)

    // 6. Calcular métricas usando el motor de cálculos
    const cac = calculateCAC(marketingExpensesCents, newPatientsCount)
    // LTV uses period revenue / active patients in period (not all-time patients)
    const periodActivePatients = convertedPatients > 0 ? convertedPatients : 1
    const ltv = calculateLTV(totalRevenueCents, periodActivePatients)
    const conversionRate = totalLeads > 0
      ? calculateConversionRate(convertedLeads, totalLeads)
      : calculateConversionRate(convertedPatients, totalPatients)
    const ltvCacRatio = calculateLTVCACRatio(ltv, cac)
    const ratioQuality = getLTVCACRatioQuality(ltvCacRatio)

    console.info('[marketing-metrics] CAC:', cac)
    console.info('[marketing-metrics] LTV:', ltv)
    console.info('[marketing-metrics] Conversion Rate:', conversionRate)
    console.info('[marketing-metrics] LTV/CAC Ratio:', ltvCacRatio)

    // 7. Preparar respuesta
    return NextResponse.json({
      period,
      dateRange: {
        start: startDateStr,
        end: endDateStr
      },
      metrics: {
        cac: {
          cents: cac,
          formatted: `$${(cac / 100).toFixed(2)}`
        },
        ltv: {
          cents: ltv,
          formatted: `$${(ltv / 100).toFixed(2)}`
        },
        conversionRate: {
          value: conversionRate,
          formatted: `${conversionRate.toFixed(1)}%`
        },
        ltvCacRatio: {
          value: ltvCacRatio,
          formatted: `${ltvCacRatio.toFixed(2)}x`,
          quality: ratioQuality
        }
      },
      rawData: {
        marketingExpensesCents,
        newPatientsCount,
        totalPatients,
        totalRevenueCents,
        convertedPatients,
        periodActivePatients,
        totalLeads,
        convertedLeads,
        conversionSource: totalLeads > 0 ? 'leads' : 'patients'
      }
    })

  } catch (error) {
    console.error('[marketing-metrics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate marketing metrics' },
      { status: 500 }
    )
  }
}
