'use client'

import { useState, useEffect, useCallback } from 'react'
import { BusinessInsights } from '@/lib/analytics'

interface UseReportsOptions {
  clinicId?: string
  autoLoad?: boolean
}

interface DashboardData {
  patientsMonth: number
  treatmentsMonth: number
  revenueMonth: number
  averageMargin: number
}

interface ReportsSummaryResponse {
  data: {
    dashboard: DashboardData
    insights: BusinessInsights
    kpis: {
      avgTreatmentValue: number
      avgMargin: number
      avgPatientsPerDay: number
      treatmentCount: number
    }
  }
}

export type ReportsKpis = ReportsSummaryResponse['data']['kpis']

const EMPTY_DASHBOARD: DashboardData = {
  patientsMonth: 0,
  treatmentsMonth: 0,
  revenueMonth: 0,
  averageMargin: 0,
}

export function useReports(options: UseReportsOptions = {}) {
  const { clinicId, autoLoad = true } = options

  const [dashboardData, setDashboardData] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [insights, setInsights] = useState<BusinessInsights | null>(null)
  const [kpis, setKpis] = useState<ReportsSummaryResponse['data']['kpis'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReportsData = useCallback(async () => {
    if (!clinicId) {
      setDashboardData(EMPTY_DASHBOARD)
      setInsights(null)
      setKpis(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ clinicId })
      const response = await fetch(`/api/reports/summary?${params.toString()}`)

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.message || 'Failed to load reports summary'
        throw new Error(message)
      }

      const json = (await response.json()) as ReportsSummaryResponse
      setDashboardData(json.data.dashboard || EMPTY_DASHBOARD)
      setInsights(json.data.insights)
      setKpis(json.data.kpis)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    if (autoLoad && clinicId) {
      void fetchReportsData()
    }
  }, [autoLoad, clinicId, fetchReportsData])

  return {
    dashboardData,
    insights,
    kpis,
    loading,
    error,
    fetchReportsData,
  }
}
