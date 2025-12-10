import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calculateCAC } from '@/lib/calc/marketing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/cac-trend
 *
 * Calcula la evolución del CAC (Customer Acquisition Cost) por mes
 * para mostrar tendencia en gráfica
 *
 * Query params:
 * - clinicId: UUID (opcional, se obtiene del contexto)
 * - months: number (meses hacia atrás, default: 12) - usado si no hay startDate/endDate
 * - startDate: YYYY-MM-DD (opcional, fecha de inicio del rango)
 * - endDate: YYYY-MM-DD (opcional, fecha de fin del rango)
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
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const months = parseInt(searchParams.get('months') || '12', 10)

    // Determinar rango de fechas
    let rangeStart: Date
    let rangeEnd: Date

    if (startDateParam && endDateParam) {
      // Usar fechas específicas
      rangeStart = new Date(startDateParam)
      rangeEnd = new Date(endDateParam)
      console.log('[cac-trend] Using date range:', startDateParam, 'to', endDateParam)
    } else {
      // Fallback a months
      rangeEnd = new Date()
      rangeStart = new Date()
      rangeStart.setMonth(rangeStart.getMonth() - months)
      console.log('[cac-trend] Using months:', months)
    }

    console.log('[cac-trend] Fetching for clinic:', clinicId)

    // Calcular rangos de fechas para cada mes dentro del rango
    const monthRanges: Array<{ start: string; end: string; label: string }> = []

    // Empezar desde el primer día del mes de rangeStart
    const currentMonth = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)

    while (currentMonth <= endMonth) {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

      monthRanges.push({
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0],
        label: monthStart.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'short'
        })
      })

      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }

    // Obtener gastos de marketing agrupados por mes
    const { data: expenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, expense_date, category_id, categories!inner(name)')
      .eq('clinic_id', clinicId)
      .gte('expense_date', monthRanges[0].start)
      .lte('expense_date', monthRanges[monthRanges.length - 1].end)

    if (expensesError) {
      console.error('[cac-trend] Error fetching expenses:', expensesError)
      throw expensesError
    }

    // Filtrar solo marketing
    const marketingExpenses = (expenses || [])
      .filter((e: any) => e.categories?.name === 'marketing')

    // Obtener pacientes agrupados por mes
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('id, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', monthRanges[0].start)
      .lte('created_at', monthRanges[monthRanges.length - 1].end + 'T23:59:59')

    if (patientsError) {
      console.error('[cac-trend] Error fetching patients:', patientsError)
      throw patientsError
    }

    // Calcular CAC por mes
    const cacByMonth = monthRanges.map(range => {
      // Gastos del mes
      const monthExpenses = marketingExpenses
        .filter((e: any) => {
          const date = e.expense_date
          return date >= range.start && date <= range.end
        })
        .reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0)

      // Pacientes del mes
      const monthPatients = (patients || [])
        .filter((p: any) => {
          const created = p.created_at.split('T')[0]
          return created >= range.start && created <= range.end
        })
        .length

      const cac = calculateCAC(monthExpenses, monthPatients)

      return {
        month: range.label,
        period: range.start,
        cacCents: cac,
        expensesCents: monthExpenses,
        newPatients: monthPatients
      }
    })

    // Calcular promedio y CAC actual
    const nonZeroCACs = cacByMonth.filter(m => m.cacCents > 0)
    const avgCAC = nonZeroCACs.length > 0
      ? Math.round(
          nonZeroCACs.reduce((sum, m) => sum + m.cacCents, 0) / nonZeroCACs.length
        )
      : 0

    const currentCAC = cacByMonth[cacByMonth.length - 1]?.cacCents || 0

    console.log('[cac-trend] CAC by month:', cacByMonth)
    console.log('[cac-trend] Average CAC:', avgCAC)
    console.log('[cac-trend] Current CAC:', currentCAC)

    return NextResponse.json({
      months: monthRanges.length, // Número real de meses en el rango
      trend: cacByMonth,
      summary: {
        currentCACCents: currentCAC,
        averageCACCents: avgCAC,
        lowestCACCents: Math.min(...cacByMonth.map(m => m.cacCents).filter(c => c > 0)),
        highestCACCents: Math.max(...cacByMonth.map(m => m.cacCents))
      }
    })

  } catch (error) {
    console.error('[cac-trend] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate CAC trend' },
      { status: 500 }
    )
  }
}
