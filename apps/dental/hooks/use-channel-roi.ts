'use client'

import { useApi } from './use-api'

export interface ChannelROIData {
  // Old format (patient_sources)
  source?: {
    id: string
    name: string
    description: string
  }
  // New format (marketing_campaigns)
  campaign?: {
    id: string
    name: string
    code?: string
    description?: string
    isActive?: boolean
  }
  patients: number
  revenueCents: number
  investmentCents: number
  roi: {
    value: number
    formatted: string
  }
}

export interface ChannelROIResponse {
  period: number
  dateRange: {
    start: string
    end: string
  }
  channels: ChannelROIData[]
  isEmpty?: boolean  // True if no marketing campaigns exist
  message?: string   // 'no_campaigns' when empty
  summary: {
    totalPatients: number
    totalMarketingExpensesCents: number
    bestChannel: {
      name: string
      roi: number
      patients: number
    } | null
    worstChannel: {
      name: string
      roi: number
      patients: number
    } | null
  }
}

interface UseChannelROIOptions {
  clinicId?: string
  period?: number  // dias - used as fallback if no dates provided
  startDate?: string  // YYYY-MM-DD - if provided, overrides period
  endDate?: string    // YYYY-MM-DD - if provided, overrides period
}

export function useChannelROI(options: UseChannelROIOptions = {}) {
  const { clinicId, period = 30, startDate, endDate } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinicId', clinicId)

  // If explicit date range provided, use it; otherwise fall back to period
  if (startDate && endDate) {
    params.set('startDate', startDate)
    params.set('endDate', endDate)
  } else {
    params.set('period', period.toString())
  }

  const endpoint = clinicId
    ? `/api/analytics/channel-roi?${params.toString()}`
    : null

  const { data, loading, error, get } = useApi<ChannelROIResponse>(endpoint, {
    autoFetch: true
  })

  return {
    data,
    loading,
    error,
    refetch: get
  }
}
