import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveClinicContext } from '@/lib/clinic'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calculateROI } from '@/lib/calc/marketing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/channel-roi
 *
 * Calcula el ROI (Return on Investment) por canal de adquisición
 * Compara inversión en marketing vs ingresos generados por canal
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
    const period = parseInt(searchParams.get('period') || '30', 10)

    // Calcular rango de fechas
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    console.log('[channel-roi] Fetching for clinic:', clinicId)
    console.log('[channel-roi] Date range:', startDateStr, 'to', endDateStr)

    // 1. Obtener todas las fuentes de pacientes de la clínica
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from('patient_sources')
      .select('id, name, description')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)

    if (sourcesError) {
      console.error('[channel-roi] Error fetching sources:', sourcesError)
      throw sourcesError
    }

    console.log('[channel-roi] Found sources:', sources?.length || 0)

    // 2. Obtener pacientes por fuente (del periodo)
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from('patients')
      .select('id, source_id, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('source_id', 'is', null)

    if (patientsError) {
      console.error('[channel-roi] Error fetching patients:', patientsError)
      throw patientsError
    }

    // 3. Obtener ingresos por paciente (treatments completados)
    const patientIds = (patients || []).map((p: any) => p.id)

    const { data: treatments, error: treatmentsError } = patientIds.length > 0
      ? await supabaseAdmin
          .from('treatments')
          .select('patient_id, price_cents')
          .eq('clinic_id', clinicId)
          .eq('status', 'completed')
          .in('patient_id', patientIds)
      : { data: [], error: null }

    if (treatmentsError) {
      console.error('[channel-roi] Error fetching treatments:', treatmentsError)
      throw treatmentsError
    }

    // 4. Obtener gastos de marketing totales (para distribuir proporcionalmente)
    const { data: marketingExpenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select('amount_cents, category_id, categories!inner(name)')
      .eq('clinic_id', clinicId)
      .gte('expense_date', startDateStr)
      .lte('expense_date', endDateStr)

    if (expensesError) {
      console.error('[channel-roi] Error fetching expenses:', expensesError)
      throw expensesError
    }

    const totalMarketingExpenses = (marketingExpenses || [])
      .filter((e: any) => e.categories?.name === 'marketing')
      .reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0)

    console.log('[channel-roi] Total marketing expenses:', totalMarketingExpenses)

    // 5. Calcular métricas por canal
    const totalPatients = (patients || []).length
    const channelMetrics = (sources || []).map((source: any) => {
      // Pacientes del canal
      const channelPatients = (patients || [])
        .filter((p: any) => p.source_id === source.id)

      const channelPatientCount = channelPatients.length
      const channelPatientIds = channelPatients.map((p: any) => p.id)

      // Ingresos del canal
      const channelRevenue = (treatments || [])
        .filter((t: any) => channelPatientIds.includes(t.patient_id))
        .reduce((sum: number, t: any) => sum + (t.price_cents || 0), 0)

      // Distribuir gastos proporcionalmente según número de pacientes
      // Si un canal aportó 20% de pacientes, asignarle 20% de gastos
      const channelInvestment = totalPatients > 0
        ? Math.round((channelPatientCount / totalPatients) * totalMarketingExpenses)
        : 0

      // Calcular ROI
      const roi = calculateROI(channelRevenue, channelInvestment)

      return {
        source: {
          id: source.id,
          name: source.name,
          description: source.description
        },
        patients: channelPatientCount,
        revenueCents: channelRevenue,
        investmentCents: channelInvestment,
        roi: {
          value: roi,
          formatted: `${roi.toFixed(1)}%`
        }
      }
    })

    // Ordenar por ROI descendente
    const sortedChannels = channelMetrics.sort((a, b) => b.roi.value - a.roi.value)

    // Identificar mejor y peor canal
    const bestChannel = sortedChannels[0]
    const worstChannel = sortedChannels[sortedChannels.length - 1]

    console.log('[channel-roi] Best channel:', bestChannel?.source.name, bestChannel?.roi.value)
    console.log('[channel-roi] Worst channel:', worstChannel?.source.name, worstChannel?.roi.value)

    return NextResponse.json({
      period,
      dateRange: {
        start: startDateStr,
        end: endDateStr
      },
      channels: sortedChannels,
      summary: {
        totalPatients,
        totalMarketingExpensesCents: totalMarketingExpenses,
        bestChannel: bestChannel ? {
          name: bestChannel.source.name,
          roi: bestChannel.roi.value,
          patients: bestChannel.patients
        } : null,
        worstChannel: worstChannel ? {
          name: worstChannel.source.name,
          roi: worstChannel.roi.value,
          patients: worstChannel.patients
        } : null
      }
    })

  } catch (error) {
    console.error('[channel-roi] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate channel ROI' },
      { status: 500 }
    )
  }
}
