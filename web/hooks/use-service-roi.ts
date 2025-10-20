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

  const endpoint = `/api/analytics/service-roi?${params.toString()}`

  const { data, loading, error, refetch } = useApi<ROIAnalysis>(endpoint, {
    enabled: !!clinicId
  })

  return {
    data,
    loading,
    error,
    refetch
  }
}
