'use client'

import { useApi } from './use-api'
import type { ROIAnalysis } from '@/app/api/analytics/service-roi/route'

interface UseServiceROIOptions {
  clinicId?: string
  days?: number
}

export function useServiceROI(options: UseServiceROIOptions = {}) {
  const { clinicId, days = 30 } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinicId', clinicId)
  params.set('days', days.toString())

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
