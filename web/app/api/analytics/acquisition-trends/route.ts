import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveClinicContext } from '@/lib/clinic'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

interface MonthlyAcquisition {
  month: string
  patients: number
  projection?: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cookieStore = await cookies()

    // Resolve clinic context
    const clinicContext = await resolveClinicContext({
      requestedClinicId: searchParams.get('clinicId'),
      cookieStore,
    })

    if ('error' in clinicContext) {
      return NextResponse.json(
        { error: clinicContext.error },
        { status: 403 }
      )
    }

    const months = parseInt(searchParams.get('months') || '12')
    const projectionMonths = parseInt(searchParams.get('projectionMonths') || '3')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date query
    let patientsQuery = supabaseAdmin
      .from('patients')
      .select('created_at')
      .eq('clinic_id', clinicContext.clinicId)
      .order('created_at', { ascending: true })

    // Apply date filters or default to last N months
    if (startDate && endDate) {
      patientsQuery = patientsQuery
        .gte('created_at', startDate)
        .lte('created_at', endDate)
    } else {
      const cutoffDate = new Date()
      cutoffDate.setMonth(cutoffDate.getMonth() - months)
      patientsQuery = patientsQuery.gte('created_at', cutoffDate.toISOString())
    }

    const { data: patients, error } = await patientsQuery

    if (error) {
      console.error('[AcquisitionTrends] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch patient data' },
        { status: 500 }
      )
    }

    // Helper function to format month (e.g., "Ene", "Feb")
    const formatMonth = (date: Date): string => {
      const month = date.toLocaleDateString('es-MX', { month: 'short' })
      return month.charAt(0).toUpperCase() + month.slice(1)
    }

    // Determine the date range for monthly buckets
    const now = new Date()
    const rangeStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const rangeEnd = endDate ? new Date(endDate) : now

    // Calculate number of months in range
    const monthsDiff = (rangeEnd.getFullYear() - rangeStart.getFullYear()) * 12 +
                       (rangeEnd.getMonth() - rangeStart.getMonth()) + 1

    // Group patients by month
    const monthlyData = new Map<string, number>()

    // Initialize all months in range with 0
    for (let i = 0; i < monthsDiff; i++) {
      const date = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1)
      const monthKey = formatMonth(date)
      monthlyData.set(monthKey, 0)
    }

    // Count patients per month
    patients?.forEach(patient => {
      const date = new Date(patient.created_at)
      const monthKey = formatMonth(date)

      if (monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + 1)
      }
    })

    // Convert to array
    const historical: MonthlyAcquisition[] = Array.from(monthlyData.entries()).map(([month, patients]) => ({
      month,
      patients
    }))

    // Calculate projection using simple linear regression
    const n = historical.length
    if (n < 2) {
      // Not enough data for projection
      return NextResponse.json({
        data: historical
      })
    }

    // Linear regression calculation
    const sumX = historical.reduce((sum, _, i) => sum + i, 0)
    const sumY = historical.reduce((sum, d) => sum + d.patients, 0)
    const sumXY = historical.reduce((sum, d, i) => sum + (i * d.patients), 0)
    const sumX2 = historical.reduce((sum, _, i) => sum + (i * i), 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Generate projections
    const projection: MonthlyAcquisition[] = []
    for (let i = 1; i <= projectionMonths; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthKey = formatMonth(futureDate)
      const projectedValue = Math.max(0, Math.round(slope * (n + i - 1) + intercept))

      projection.push({
        month: monthKey,
        patients: 0,
        projection: projectedValue
      })
    }

    return NextResponse.json({
      data: [...historical, ...projection]
    })

  } catch (error) {
    console.error('[AcquisitionTrends] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
