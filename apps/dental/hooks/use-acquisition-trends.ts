import { useApi } from './use-api'
import { useCurrentClinic } from './use-current-clinic'

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
  startDate?: string
  endDate?: string
}

export function useAcquisitionTrends(options: UseAcquisitionTrendsOptions = {}) {
  const { currentClinic } = useCurrentClinic()
  const clinicId = options.clinicId || currentClinic?.id
  const { months = 12, projectionMonths = 3, startDate, endDate } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinicId', clinicId)
  params.set('projectionMonths', projectionMonths.toString())

  // Prefer startDate/endDate over months
  if (startDate && endDate) {
    params.set('startDate', startDate)
    params.set('endDate', endDate)
  } else {
    params.set('months', months.toString())
  }

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
