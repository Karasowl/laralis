'use client'

import { useApi } from './use-api'
import type { ROIAnalysis } from '@/app/api/analytics/service-roi/route'

interface UseServiceROIOptions {
  clinicId?: string
  days?: number
  startDate?: string  // YYYY-MM-DD - if provided, overrides days
  endDate?: string    // YYYY-MM-DD - if provided, overrides days
}

export function useServiceROI(options: UseServiceROIOptions = {}) {
  const { clinicId, days = 30, startDate, endDate } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinicId', clinicId)

  // If explicit date range provided, use it; otherwise fall back to days
  if (startDate && endDate) {
    params.set('startDate', startDate)
    params.set('endDate', endDate)
  } else {
    params.set('days', days.toString())
  }

  const endpoint = clinicId ? `/api/analytics/service-roi?${params.toString()}` : null

  const { data, loading, error, refetch } = useApi<ROIAnalysis>(endpoint, {
    autoFetch: true
  })

  return {
    data,
    loading,
    error,
    refetch
  }
}
