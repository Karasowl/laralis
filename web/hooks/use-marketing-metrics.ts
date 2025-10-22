'use client'

import { useApi } from './use-api'

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
  period?: number // días
}

export function useMarketingMetrics(options: UseMarketingMetricsOptions = {}) {
  const { clinicId, period = 30 } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinicId', clinicId)
  params.set('period', period.toString())

  const endpoint = clinicId
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
