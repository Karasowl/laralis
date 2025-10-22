'use client'

import { useApi } from './use-api'

export interface ChannelROIData {
  source: {
    id: string
    name: string
    description: string
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
  period?: number
}

export function useChannelROI(options: UseChannelROIOptions = {}) {
  const { clinicId, period = 30 } = options

  const params = new URLSearchParams()
  if (clinicId) params.set('clinicId', clinicId)
  params.set('period', period.toString())

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
