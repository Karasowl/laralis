import { useApi } from './use-api'

interface MonthlyData {
  month: string
  patients: number
  projection?: number
}

interface AcquisitionTrendsResponse {
  data: MonthlyData[]
}

interface UseAcquisitionTrendsOptions {
  clinicId?: string
  months?: number
  projectionMonths?: number
}

export function useAcquisitionTrends({
  clinicId,
  months = 12,
  projectionMonths = 3
}: UseAcquisitionTrendsOptions = {}) {
  const params = new URLSearchParams()

  if (clinicId) params.append('clinicId', clinicId)
  if (months) params.append('months', months.toString())
  if (projectionMonths) params.append('projectionMonths', projectionMonths.toString())

  const endpoint = clinicId
    ? `/api/analytics/acquisition-trends?${params.toString()}`
    : null

  const { data, loading, error, get } = useApi<AcquisitionTrendsResponse>(endpoint, {
    autoFetch: true
  })

  return {
    data: data?.data || [],
    loading,
    error,
    refetch: get
  }
}
