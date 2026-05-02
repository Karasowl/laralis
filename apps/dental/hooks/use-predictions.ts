'use client'

import { useApi } from './use-api'
import { useCurrentClinic } from './use-current-clinic'

export interface PredictionData {
  nextMonth: number // cents
  nextQuarter: number // cents
  yearEnd: number // cents
  confidence: number // 0-100
  trend: 'up' | 'down' | 'stable'
  monthsOfData: number
}

interface PredictionsResponse {
  data: PredictionData | null
  message?: string
  minimumMonthsRequired?: number
}

/**
 * Hook to fetch revenue predictions for the current clinic
 *
 * @example
 * const { predictions, loading, hasData, insufficientData } = usePredictions()
 *
 * if (loading) return <Skeleton />
 * if (insufficientData) return <NoDataMessage />
 * return <PredictionCard data={predictions} />
 */
export function usePredictions() {
  const { currentClinic, loading: clinicLoading } = useCurrentClinic()

  const clinicId = currentClinic?.id

  const { data, loading, error, fetchData } = useApi<PredictionsResponse>(
    clinicId ? `/api/analytics/predictions?clinicId=${clinicId}` : null,
    { autoFetch: true }
  )

  return {
    predictions: data?.data || null,
    loading: loading || clinicLoading,
    error,
    hasData: !!data?.data,
    insufficientData: data && !data.data,
    refresh: fetchData,
  }
}
