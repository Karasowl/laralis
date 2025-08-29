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

export interface AssetsSummary {
  total_value_cents: number
  monthly_depreciation_cents: number
  count: number
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

  // Use API hook for assets depreciation
  const assetsApi = useApi<AssetsSummary>('/api/assets/depreciation')

  // Calculate summary using memoization
  const summary = useMemo(() => {
    const fixedCosts = crud.items || []
    const assetsDepreciation = assetsApi.data || {
      total_value_cents: 0,
      monthly_depreciation_cents: 0,
      count: 0
    }
    
    const totalManualCosts = fixedCosts.reduce((sum, cost) => sum + cost.amount_cents, 0)
    const totalCosts = totalManualCosts + assetsDepreciation.monthly_depreciation_cents
    
    return {
      totalManualCosts,
      totalCosts,
      manualCount: fixedCosts.length,
      assetsCount: assetsDepreciation.count,
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
    
    // From API hooks
    assetsDepreciation: assetsApi.data || {
      total_value_cents: 0,
      monthly_depreciation_cents: 0,
      count: 0
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