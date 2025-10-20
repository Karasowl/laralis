import { useState, useEffect } from 'react'

interface MarketingPeriod {
  period: string
  investmentCents: number
  revenueCents: number
  patientsCount: number
  roi: number
  avgRevenuePerPatientCents: number
}

interface MarketingROISummary {
  totalInvestmentCents: number
  totalRevenueCents: number
  totalPatients: number
  overallROI: number
  avgRevenuePerPatientCents: number
  avgInvestmentPerPatientCents: number
}

interface MarketingROIData {
  periods: MarketingPeriod[]
  summary: MarketingROISummary
}

interface UseMarketingROIOptions {
  clinicId?: string
  months?: number
}

export function useMarketingROI({ clinicId, months = 6 }: UseMarketingROIOptions) {
  const [data, setData] = useState<MarketingROIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          clinicId,
          months: months.toString()
        })

        const response = await fetch(`/api/marketing/roi?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch marketing ROI data')
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error('Error fetching marketing ROI:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [clinicId, months])

  return { data, loading, error }
}
