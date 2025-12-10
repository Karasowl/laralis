'use client'

import { useApi } from './use-api'
import { useCurrentClinic } from './use-current-clinic'

export interface MarketingMetrics {
  period: number
  dateRange: {
    start: string
    end: string
  }
  metrics: {
    cac: {
      cents: number
      formatted: string
    }
    ltv: {
      cents: number
      formatted: string
    }
    conversionRate: {
      value: number
      formatted: string
    }
    ltvCacRatio: {
      value: number
      formatted: string
      quality: {
        label: 'excellent' | 'good' | 'acceptable' | 'critical' | 'unknown'
        color: 'green' | 'blue' | 'yellow' | 'red' | 'gray'
        message: string
      }
    }
  }
  rawData: {
    marketingExpensesCents: number
    newPatientsCount: number
    totalPatients: number
    totalRevenueCents: number
    convertedPatients: number
  }
}

interface UseMarketingMetricsOptions {
  clinicId?: string
  period?: number // dias - used as fallback if no dates provided
  startDate?: string  // YYYY-MM-DD - if provided, overrides period
  endDate?: string    // YYYY-MM-DD - if provided, overrides period
}

export function useMarketingMetrics(options: UseMarketingMetricsOptions = {}) {
  const { currentClinic } = useCurrentClinic()
  const resolvedClinicId = options.clinicId || currentClinic?.id
  const { period = 30, startDate, endDate } = options

  const params = new URLSearchParams()
  if (resolvedClinicId) params.set('clinicId', resolvedClinicId)

  // If explicit date range provided, use it; otherwise fall back to period
  if (startDate && endDate) {
    params.set('startDate', startDate)
    params.set('endDate', endDate)
  } else {
    params.set('period', period.toString())
  }

  const endpoint = resolvedClinicId
    ? `/api/analytics/marketing-metrics?${params.toString()}`
    : null

  const { data, loading, error, get } = useApi<MarketingMetrics>(endpoint, {
    autoFetch: true
  })

  return {
    data,
    loading,
    error,
    refetch: get
  }
}
