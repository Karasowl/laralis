import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { forbiddenIfMissingPermission } from '@/lib/permissions'
import {
  getFirstTreatmentDateByPatient,
  patientsAcquiredInRange,
} from '@/lib/calc/patient-acquisition'
import {
  calculateCAC,
  calculateLTV,
  calculateConversionRate,
  calculateLTVCACRatio,
  getLTVCACRatioQuality
} from '@/lib/calc/marketing'
import { listConvexDocumentsByClinic, listConvexTable } from '@/lib/convex/server'
import { shouldReturnConvexData } from '@/lib/data-backend'

export const dynamic = 'force-dynamic'

type ImportedRecord = Record<string, any>

// NOTE: This route's read path produces only aggregates (counts / cent sums),
// never passing individual Convex rows through to the response, so the usual
// normalizeConvexRecord(_id/_creationTime/legacy* stripper) is not needed here.

/**
 * Convex equivalent of getFirstTreatmentDateByPatient(): reads ALL treatments
 * for the clinic (no date filter), keeps non-null treatment_date and
 * status !== 'cancelled', and builds patientId -> earliest YYYY-MM-DD.
 * Mirrors lib/calc/patient-acquisition.ts exactly (lexicographic date compare).
 */
function buildFirstTreatmentMapFromConvex(treatments: ImportedRecord[]): Map<string, string> {
  const firstDate = new Map<string, string>()
  for (const t of treatments) {
    if (t.treatment_date == null) continue
    if (t.status == null || t.status === 'cancelled') continue
    const pid = t.patient_id
    if (!pid) continue
    const iso = String(t.treatment_date || '').slice(0, 10)
    if (!iso) continue
    const existing = firstDate.get(pid)
    if (!existing || iso < existing) firstDate.set(pid, iso)
  }
  return firstDate
}

/**
 * Reads the SAME tables the Supabase path reads (expenses + categories for the
 * marketing-cost inner-join, all treatments for first-treatment acquisition,
 * leads, patients, and period-completed treatments) directly from Convex and
 * reproduces the identical JS filtering / date-bucketing / aggregation. Returns
 * the same raw aggregates the Supabase branch computes, which then feed the
 * shared pure calc functions in the handler.
 */
async function getMarketingMetricsRawFromConvex(
  clinicId: string,
  startDateStr: string,
  endDateStr: string,
  startIso: string,
  endIso: string
) {
  const [expenses, categories, treatments, leads, patients] = await Promise.all([
    listConvexDocumentsByClinic('expenses', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexTable('categories', 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('treatments', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('leads', clinicId, 10000) as Promise<ImportedRecord[]>,
    listConvexDocumentsByClinic('patients', clinicId, 10000) as Promise<ImportedRecord[]>,
  ])

  // Reassemble the expenses -> categories inner join (Convex has no joins).
  // Match on category_id; INNER join semantics => drop expenses whose
  // category_id does not resolve to a category row.
  const categoryById = new Map<string, ImportedRecord>()
  for (const cat of categories) {
    const ids = [cat.id, cat.legacyId].filter(Boolean).map((value) => String(value))
    for (const id of ids) categoryById.set(id, cat)
  }

  const marketingExpensesCents = expenses
    .filter((expense) => {
      // expense_date in [startDateStr, endDateStr] (lexicographic-safe YYYY-MM-DD)
      const expenseDate = String(expense.expense_date || '')
      if (expenseDate < startDateStr || expenseDate > endDateStr) return false
      // INNER join on category_id
      const category = expense.category_id ? categoryById.get(String(expense.category_id)) : undefined
      if (!category) return false
      return category.name === 'marketing'
    })
    .reduce((sum, expense) => sum + (Number(expense.amount_cents) || 0), 0)

  // First-treatment acquisition map (mirrors getFirstTreatmentDateByPatient).
  const firstTreatmentByPatient = buildFirstTreatmentMapFromConvex(treatments)
  const acquiredInPeriod = patientsAcquiredInRange(firstTreatmentByPatient, startDateStr, endDateStr)
  const newPatientsCount = acquiredInPeriod.size

  // Leads in period: created_at within [startIso, endIso] (full ISO timestamps,
  // lexicographic compare is order-preserving for ISO 8601).
  const leadsInPeriod = leads.filter((lead) => {
    const createdAt = String(lead.created_at || '')
    return createdAt >= startIso && createdAt <= endIso
  })
  const totalLeads = leadsInPeriod.length
  const convertedLeads = leadsInPeriod.filter(
    (lead) => lead.status === 'converted' || lead.converted_patient_id
  ).length

  // All patients (count only).
  const totalPatients = patients.length

  // Completed treatments in period (status === 'completed', treatment_date in range).
  const completedTreatments = treatments.filter((t) => {
    if (t.status !== 'completed') return false
    const treatmentDate = String(t.treatment_date || '')
    return treatmentDate >= startDateStr && treatmentDate <= endDateStr
  })
  const totalRevenueCents = completedTreatments.reduce(
    (sum, t) => sum + (Number(t.price_cents) || 0),
    0
  )
  const uniquePatients = new Set(completedTreatments.map((t) => t.patient_id))
  const convertedPatients = uniquePatients.size

  return {
    marketingExpensesCents,
    newPatientsCount,
    totalLeads,
    convertedLeads,
    totalPatients,
    totalRevenueCents,
    convertedPatients,
  }
}

/**
 * Shared response builder so the Supabase and Convex branches emit a
 * byte-identical shape. Runs the SAME pure calc functions (lib/calc/marketing)
 * over identical raw aggregates — only the data source differs.
 */
function buildMarketingMetricsResponse(params: {
  period: number
  startDateStr: string
  endDateStr: string
  marketingExpensesCents: number
  newPatientsCount: number
  totalLeads: number
  convertedLeads: number
  totalPatients: number
  totalRevenueCents: number
  convertedPatients: number
}) {
  const {
    period,
    startDateStr,
    endDateStr,
    marketingExpensesCents,
    newPatientsCount,
    totalLeads,
    convertedLeads,
    totalPatients,
    totalRevenueCents,
    convertedPatients,
  } = params

  const cac = calculateCAC(marketingExpensesCents, newPatientsCount)
  // LTV uses period revenue / active patients in period (not all-time patients)
  const periodActivePatients = convertedPatients > 0 ? convertedPatients : 1
  const ltv = calculateLTV(totalRevenueCents, periodActivePatients)
  const conversionRate = totalLeads > 0
    ? calculateConversionRate(convertedLeads, totalLeads)
    : calculateConversionRate(convertedPatients, totalPatients)
  const ltvCacRatio = calculateLTVCACRatio(ltv, cac)
  const ratioQuality = getLTVCACRatioQuality(ltvCacRatio)

  return {
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
  }
}

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

    const { clinicId, userId } = ctx
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'campaigns.view')
    if (forbidden) return forbidden

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

    // Convex read branch (flag-gated). Fetches the SAME tables, reproduces the
    // identical JS filtering / date-bucketing / aggregation (incl. the
    // expenses->categories inner-join), feeds the SAME pure calc functions, and
    // returns the SAME response shape. Default (no flag) behavior is unchanged.
    if (shouldReturnConvexData('marketing-metrics')) {
      const raw = await getMarketingMetricsRawFromConvex(
        clinicId,
        startDateStr,
        endDateStr,
        startDate.toISOString(),
        endDate.toISOString()
      )
      return NextResponse.json(
        buildMarketingMetricsResponse({
          period,
          startDateStr,
          endDateStr,
          ...raw,
        })
      )
    }

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

    // 2. "Pacientes nuevos" = pacientes cuyo PRIMER tratamiento cae en el
    //    periodo. patients.created_at se descartó porque cuenta leads que
    //    nunca llegaron a venir a una cita.
    const firstTreatmentByPatient = await getFirstTreatmentDateByPatient(clinicId)
    const acquiredInPeriod = patientsAcquiredInRange(
      firstTreatmentByPatient,
      startDateStr,
      endDateStr
    )
    const newPatientsCount = acquiredInPeriod.size
    console.info('[marketing-metrics] New patients (by first treatment):', newPatientsCount)

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
