import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { withPermission } from '@/lib/middleware/with-permission'

export const dynamic = 'force-dynamic'


export interface ServiceROI {
  service_id: string
  service_name: string

  // Métricas básicas
  total_sales: number           // Frecuencia de venta
  total_revenue_cents: number   // Ingresos totales
  total_cost_cents: number      // Costos totales (fijos + variables)
  total_profit_cents: number    // Ganancia total

  // Métricas por unidad
  avg_profit_per_sale_cents: number  // Ganancia promedio/venta
  avg_revenue_per_sale_cents: number // Ticket promedio
  avg_cost_per_sale_cents: number    // Costo promedio/venta

  // Eficiencia
  total_minutes: number              // Total de minutos trabajados
  profit_per_hour_cents: number      // Ganancia/hora trabajada
  roi_percentage: number             // ROI real

  // Clasificación automática
  category: 'star' | 'gem' | 'volume' | 'review'
  category_label: string
}

export interface ROIAnalysis {
  services: ServiceROI[]
  period_start: string
  period_end: string
  totals: {
    total_profit_cents: number
    total_revenue_cents: number
    total_sales: number
    avg_roi_percentage: number
  }
  insights: {
    top_profit_service: ServiceROI | null
    top_profit_per_sale_service: ServiceROI | null
    top_frequency_service: ServiceROI | null
    hidden_gems: ServiceROI[]
    needs_review: ServiceROI[]
  }
}

function classifyService(
  service: Omit<ServiceROI, 'category' | 'category_label'>,
  medianSales: number,
  medianProfitPerSale: number
): { category: ServiceROI['category'], category_label: string } {
  const isHighFrequency = service.total_sales >= medianSales
  const isHighProfit = service.avg_profit_per_sale_cents >= medianProfitPerSale

  if (isHighProfit && isHighFrequency) {
    return { category: 'star', category_label: 'Estrella' }
  }
  if (isHighProfit && !isHighFrequency) {
    return { category: 'gem', category_label: 'Joya Oculta' }
  }
  if (!isHighProfit && isHighFrequency) {
    return { category: 'volume', category_label: 'Volumen' }
  }
  return { category: 'review', category_label: 'Revisar' }
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export const GET = withPermission('financial_reports.view', async (request, context) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const { clinicId } = context

    // Parse date range - supports explicit dates or days lookback
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam, 10) : 30

    let startDateStr: string
    let endDateStr: string

    if (startDateParam && endDateParam) {
      // Use explicit date range
      startDateStr = startDateParam
      endDateStr = endDateParam
    } else {
      // Fall back to days lookback
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      startDateStr = startDate.toISOString().split('T')[0]
      endDateStr = endDate.toISOString().split('T')[0]
    }

    // Fetch completed treatments with service information
    const { data: treatments, error: treatmentsError } = await supabaseAdmin
      .from('treatments')
      .select(`
        id,
        service_id,
        price_cents,
        fixed_cost_per_minute_cents,
        variable_cost_cents,
        minutes,
        treatment_date,
        status,
        services!inner (
          id,
          name
        )
      `)
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .gte('treatment_date', startDateStr)
      .lte('treatment_date', endDateStr)

    if (treatmentsError) {
      console.error('[service-roi] Error fetching treatments:', treatmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch treatments', message: treatmentsError.message },
        { status: 500 }
      )
    }

    if (!treatments || treatments.length === 0) {
      return NextResponse.json<ROIAnalysis>({
        services: [],
        period_start: startDateStr,
        period_end: endDateStr,
        totals: {
          total_profit_cents: 0,
          total_revenue_cents: 0,
          total_sales: 0,
          avg_roi_percentage: 0
        },
        insights: {
          top_profit_service: null,
          top_profit_per_sale_service: null,
          top_frequency_service: null,
          hidden_gems: [],
          needs_review: []
        }
      })
    }

    // Group by service and calculate metrics
    const serviceMap = new Map<string, {
      service_id: string
      service_name: string
      sales: number
      total_revenue_cents: number
      total_fixed_cost_cents: number
      total_variable_cost_cents: number
      total_minutes: number
    }>()

    for (const treatment of treatments) {
      const serviceId = treatment.service_id
      const serviceName = (treatment.services as any)?.name || 'Unknown Service'

      const fixedCostCents = Math.round(
        (treatment.fixed_cost_per_minute_cents || 0) * (treatment.minutes || 0)
      )
      const variableCostCents = treatment.variable_cost_cents || 0

      if (!serviceMap.has(serviceId)) {
        serviceMap.set(serviceId, {
          service_id: serviceId,
          service_name: serviceName,
          sales: 0,
          total_revenue_cents: 0,
          total_fixed_cost_cents: 0,
          total_variable_cost_cents: 0,
          total_minutes: 0
        })
      }

      const service = serviceMap.get(serviceId)!
      service.sales += 1
      service.total_revenue_cents += treatment.price_cents || 0
      service.total_fixed_cost_cents += fixedCostCents
      service.total_variable_cost_cents += variableCostCents
      service.total_minutes += treatment.minutes || 0
    }

    // Convert to ServiceROI array (without classification)
    const servicesWithoutCategory = Array.from(serviceMap.values()).map(service => {
      const totalCostCents = service.total_fixed_cost_cents + service.total_variable_cost_cents
      const totalProfitCents = service.total_revenue_cents - totalCostCents
      const profitPerHourCents = service.total_minutes > 0
        ? Math.round((totalProfitCents / service.total_minutes) * 60)
        : 0
      const roiPercentage = totalCostCents > 0
        ? Math.round((totalProfitCents / totalCostCents) * 100)
        : 0

      return {
        service_id: service.service_id,
        service_name: service.service_name,
        total_sales: service.sales,
        total_revenue_cents: service.total_revenue_cents,
        total_cost_cents: totalCostCents,
        total_profit_cents: totalProfitCents,
        avg_profit_per_sale_cents: Math.round(totalProfitCents / service.sales),
        avg_revenue_per_sale_cents: Math.round(service.total_revenue_cents / service.sales),
        avg_cost_per_sale_cents: Math.round(totalCostCents / service.sales),
        total_minutes: service.total_minutes,
        profit_per_hour_cents: profitPerHourCents,
        roi_percentage: roiPercentage
      }
    })

    // Calculate medians for classification
    const salesValues = servicesWithoutCategory.map(s => s.total_sales)
    const profitPerSaleValues = servicesWithoutCategory.map(s => s.avg_profit_per_sale_cents)

    const medianSales = calculateMedian(salesValues)
    const medianProfitPerSale = calculateMedian(profitPerSaleValues)

    // Classify services
    const services: ServiceROI[] = servicesWithoutCategory.map(service => {
      const classification = classifyService(service, medianSales, medianProfitPerSale)
      return {
        ...service,
        ...classification
      }
    })

    // Sort by total profit (most important)
    services.sort((a, b) => b.total_profit_cents - a.total_profit_cents)

    // Calculate totals and insights
    const totalProfitCents = services.reduce((sum, s) => sum + s.total_profit_cents, 0)
    const totalRevenueCents = services.reduce((sum, s) => sum + s.total_revenue_cents, 0)
    const totalSales = services.reduce((sum, s) => sum + s.total_sales, 0)
    const avgRoiPercentage = services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.roi_percentage, 0) / services.length)
      : 0

    const topProfitService = services[0] || null
    const topProfitPerSaleService = [...services].sort((a, b) =>
      b.avg_profit_per_sale_cents - a.avg_profit_per_sale_cents
    )[0] || null
    const topFrequencyService = [...services].sort((a, b) =>
      b.total_sales - a.total_sales
    )[0] || null

    const hiddenGems = services.filter(s => s.category === 'gem')
    const needsReview = services.filter(s => s.category === 'review')

    const analysis: ROIAnalysis = {
      services,
      period_start: startDateStr,
      period_end: endDateStr,
      totals: {
        total_profit_cents: totalProfitCents,
        total_revenue_cents: totalRevenueCents,
        total_sales: totalSales,
        avg_roi_percentage: avgRoiPercentage
      },
      insights: {
        top_profit_service: topProfitService,
        top_profit_per_sale_service: topProfitPerSaleService,
        top_frequency_service: topFrequencyService,
        hidden_gems: hiddenGems,
        needs_review: needsReview
      }
    }

    return NextResponse.json<ROIAnalysis>(analysis)

  } catch (error) {
    console.error('Unexpected error in GET /api/analytics/service-roi:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
