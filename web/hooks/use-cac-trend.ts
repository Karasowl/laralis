'use client'

import { useApi } from './use-api'

export interface CACTrendMonth {
  month: string
  period: string
  cacCents: number
  expensesCents: number
  newPatients: number
}

export interface CACTrendData {
  months: number
  trend: CACTrendMonth[]
  summary: {
    currentCACCents: number
    averageCACCents: number
    lowestCACCents: number
    highestCACCents: number
  }
}

interface UseCACTrendOptions {
  clinicId?: string
  months?: number
}

export function useCACTrend(options: UseCACTrendOptions = {}) {
  const { clinicId, months = 12 } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinicId', clinicId)
  params.set('months', months.toString())

  const endpoint = clinicId
    ? `/api/analytics/cac-trend?${params.toString()}`
    : null

  const { data, loading, error, get } = useApi<CACTrendData>(endpoint, {
    autoFetch: true
  })

  return {
    data,
    loading,
    error,
    refetch: get
  }
}
