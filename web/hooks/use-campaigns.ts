'use client'

import { useApi } from './use-api'

export interface Campaign {
  id: string
  clinic_id: string
  platform_id: string
  name: string
  code?: string
  is_active: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  platform?: {
    id: string
    name: string
    display_name: string
  }
}

interface UseCampaignsOptions {
  clinicId?: string
  activeOnly?: boolean
}

export function useCampaigns(options: UseCampaignsOptions = {}) {
  const { activeOnly = true } = options

  const endpoint = `/api/campaigns${activeOnly ? '?active=true' : ''}`

  const { data, loading, error, refetch } = useApi<Campaign[]>(endpoint)

  return {
    campaigns: data || [],
    loading,
    error,
    refetch,
  }
}
