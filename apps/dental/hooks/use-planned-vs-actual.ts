'use client'

import { useApi } from './use-api'

export interface CategoryVariance {
  category: string
  planned_cents: number
  actual_cents: number
  variance_cents: number
  variance_pct: number
}

export interface PlannedVsActualData {
  total_planned_cents: number
  total_actual_cents: number
  total_variance_cents: number
  total_variance_pct: number
  category_breakdown: CategoryVariance[]
  period: {
    start: string | null
    end: string | null
  }
  planned_count: number
  actual_count: number
  metadata: {
    description: string
    insight: string
  }
}

interface UsePlannedVsActualOptions {
  clinicId?: string
  startDate?: string  // YYYY-MM-DD
  endDate?: string    // YYYY-MM-DD
  autoFetch?: boolean
}

export function usePlannedVsActual(options: UsePlannedVsActualOptions = {}) {
  const { clinicId, startDate, endDate, autoFetch = true } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinic_id', clinicId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)

  const endpoint = clinicId
    ? `/api/analytics/planned-vs-actual?${params.toString()}`
    : null

  const { data, loading, error, get } = useApi<PlannedVsActualData>(endpoint, {
    autoFetch
  })

  return {
    data,
    loading,
    error,
    refetch: get
  }
}
