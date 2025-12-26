'use client'

import { useApi } from './use-api'

export interface ProfitCosts {
  expenses_cents: number               // Registered expenses (what you actually paid)
  variable_cents: number               // Materials from treatments
  configured_fixed_cents: number       // From fixed_costs table (prorated)
  depreciation_cents: number           // From assets (prorated, informational)
  total_cents: number
}

export interface ProfitMetrics {
  // NEW: Real profit based on registered expenses
  real_profit_cents: number
  real_margin_pct: number
  // Theoretical profit (if you spent exactly what you configured)
  theoretical_profit_cents: number
  theoretical_margin_pct: number
  // Difference: positive = spent less than expected, negative = spent more
  difference_cents: number
  // Legacy fields for backward compatibility
  gross_profit_cents: number
  gross_margin_pct: number
  net_profit_cents: number
  net_margin_pct: number
}

export interface ProfitBenchmarks {
  gross_margin_target_pct: number
  operating_margin_target_pct: number
  ebitda_margin_target_pct: number
  overhead_ratio_target_pct: number
}

export interface ProfitAnalysisData {
  revenue_cents: number
  costs: ProfitCosts
  profits: ProfitMetrics
  benchmarks: ProfitBenchmarks
  period: {
    start: string | null
    end: string | null
    days: number
  }
  treatments_count: number
  expenses_count: number
  metadata?: {
    monthly_configured_fixed_cents: number
    monthly_depreciation_cents: number
    proration_factor: number
    explanation: string
  }
}

interface UseProfitAnalysisOptions {
  clinicId?: string
  startDate?: string  // YYYY-MM-DD
  endDate?: string    // YYYY-MM-DD
  autoFetch?: boolean
}

export function useProfitAnalysis(options: UseProfitAnalysisOptions = {}) {
  const { clinicId, startDate, endDate, autoFetch = true } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinic_id', clinicId)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)

  const endpoint = clinicId
    ? `/api/analytics/profit-analysis?${params.toString()}`
    : null

  const { data, loading, error, get } = useApi<ProfitAnalysisData>(endpoint, {
    autoFetch
  })

  return {
    data,
    loading,
    error,
    refetch: get
  }
}
