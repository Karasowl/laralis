'use client'

import { useCallback, useMemo } from 'react'
import { useCrudOperations } from './use-crud-operations'
import { useApi } from './use-api'

export interface FixedCost {
  id: string
  clinic_id: string
  category: string
  concept: string
  amount_cents: number
  created_at: string
  updated_at: string
}

export interface AssetsSummaryData {
  monthly_depreciation_cents: number
  total_investment_cents: number
  asset_count: number
  average_depreciation_months: number
  minimal_asset_present: boolean
}

// API response wrapper
export interface AssetsSummary {
  data: AssetsSummaryData
}

interface UseFixedCostsOptions {
  clinicId?: string
  autoLoad?: boolean
}

export function useFixedCosts(options: UseFixedCostsOptions = {}) {
  const { clinicId, autoLoad = true } = options

  // Use generic CRUD for fixed costs
  const crud = useCrudOperations<FixedCost>({
    endpoint: '/api/fixed-costs',
    entityName: 'Fixed Cost',
    includeClinicId: true
  })

  // Use API hook for assets depreciation - FIXED: Changed from /depreciation to /summary
  // Auto-fetch depreciation data on mount
  // CRITICAL: Include clinicId in query params for proper filtering
  const endpoint = clinicId ? `/api/assets/summary?clinicId=${clinicId}` : null
  const assetsApi = useApi<AssetsSummary>(endpoint, { autoFetch: true })

  // Calculate summary using memoization
  const summary = useMemo(() => {
    const fixedCosts = crud.items || []
    // Access the nested data object from API response
    const assetsDepreciation = assetsApi.data?.data || {
      monthly_depreciation_cents: 0,
      total_investment_cents: 0,
      asset_count: 0,
      average_depreciation_months: 0,
      minimal_asset_present: false
    }

    const totalManualCosts = fixedCosts.reduce((sum, cost) => sum + cost.amount_cents, 0)
    const totalCosts = totalManualCosts + assetsDepreciation.monthly_depreciation_cents

    return {
      totalManualCosts,
      totalCosts,
      manualCount: fixedCosts.length,
      assetsCount: assetsDepreciation.asset_count,
      monthlyDepreciation: assetsDepreciation.monthly_depreciation_cents
    }
  }, [crud.items, assetsApi.data])

  // Load assets depreciation data
  const loadAssetsData = useCallback(async () => {
    await assetsApi.get()
  }, [assetsApi])

  // Enhanced create with proper data structure
  const createFixedCost = useCallback(async (data: any): Promise<boolean> => {
    return await crud.handleCreate({
      ...data,
      clinic_id: clinicId
    })
  }, [crud, clinicId])

  // Enhanced update
  const updateFixedCost = useCallback(async (id: string, data: any): Promise<boolean> => {
    return await crud.handleUpdate(id, data)
  }, [crud])

  return {
    // From CRUD operations
    fixedCosts: crud.items,
    loading: crud.loading || assetsApi.loading,
    error: null,

    // From API hooks - access nested data object
    assetsDepreciation: assetsApi.data?.data || {
      monthly_depreciation_cents: 0,
      total_investment_cents: 0,
      asset_count: 0,
      average_depreciation_months: 0,
      minimal_asset_present: false
    },

    // Calculated data
    summary,

    // Operations
    fetchFixedCosts: crud.fetchItems,
    createFixedCost,
    updateFixedCost,
    deleteFixedCost: crud.handleDelete,

    // Load additional data
    loadAssetsData
  }
}