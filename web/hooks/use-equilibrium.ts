'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParallelApi } from '@/hooks/use-api'

export interface EquilibriumData {
  fixedCostsCents: number
  variableCostPercentage: number
  contributionMargin: number
  breakEvenRevenueCents: number
  dailyTargetCents: number
  safetyMarginCents: number
  workDays: number
  monthlyTargetCents: number
  currentRevenueCents: number
  revenueGapCents: number
  daysToBreakEven: number
}

interface UseEquilibriumOptions {
  clinicId?: string
  defaultWorkDays?: number
  defaultVariableCostPercentage?: number
  safetyMarginPercentage?: number
}

// Single Responsibility: Equilibrium calculations
export class EquilibriumCalculator {
  static calculate(
    fixedCostsCents: number,
    variableCostPercentage: number,
    workDays: number,
    safetyMarginPercentage: number = 20
  ): Partial<EquilibriumData> {
    const contributionMargin = 100 - variableCostPercentage
    const breakEvenRevenueCents = Math.round(
      (fixedCostsCents * 100) / contributionMargin
    )
    const safetyMarginCents = Math.round(
      breakEvenRevenueCents * (safetyMarginPercentage / 100)
    )
    const monthlyTargetCents = breakEvenRevenueCents + safetyMarginCents
    const dailyTargetCents = Math.round(monthlyTargetCents / workDays)

    return {
      contributionMargin,
      breakEvenRevenueCents,
      dailyTargetCents,
      safetyMarginCents,
      monthlyTargetCents
    }
  }

  static calculateProgress(
    currentRevenueCents: number,
    targetRevenueCents: number,
    dailyTargetCents: number
  ): { revenueGapCents: number; daysToBreakEven: number; progressPercentage: number } {
    const revenueGapCents = Math.max(0, targetRevenueCents - currentRevenueCents)
    const daysToBreakEven = dailyTargetCents > 0 
      ? Math.ceil(revenueGapCents / dailyTargetCents)
      : 0
    const progressPercentage = targetRevenueCents > 0
      ? Math.min(100, (currentRevenueCents / targetRevenueCents) * 100)
      : 0

    return { revenueGapCents, daysToBreakEven, progressPercentage }
  }
}

// Interface Segregation: Equilibrium operations
interface IEquilibriumOperations {
  data: EquilibriumData
  loading: boolean
  error: string | null
  updateWorkDays: (days: number) => void
  updateVariableCostPercentage: (percentage: number) => void
  updateCurrentRevenue: (cents: number) => void
  refreshData: () => Promise<void>
  saveSettings: () => Promise<void>
}

// Main hook following Dependency Inversion
export function useEquilibrium(options: UseEquilibriumOptions = {}): IEquilibriumOperations {
  const {
    clinicId,
    defaultWorkDays = 20,
    defaultVariableCostPercentage = 35,
    safetyMarginPercentage = 20
  } = options

  const [data, setData] = useState<EquilibriumData>({
    fixedCostsCents: 0,
    variableCostPercentage: defaultVariableCostPercentage,
    contributionMargin: 65,
    breakEvenRevenueCents: 0,
    dailyTargetCents: 0,
    safetyMarginCents: 0,
    workDays: defaultWorkDays,
    monthlyTargetCents: 0,
    currentRevenueCents: 0,
    revenueGapCents: 0,
    daysToBreakEven: 0
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fetchAll } = useParallelApi()

  // Load all data
  const loadData = useCallback(async () => {
    if (!clinicId) {
      setError('No clinic selected')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [fixedCostsRes, assetsRes, timeRes, revenueRes] = await fetchAll([
        { endpoint: `/api/fixed-costs?clinicId=${clinicId}` },
        { endpoint: `/api/assets/summary?clinicId=${clinicId}` },
        { endpoint: `/api/settings/time?clinicId=${clinicId}` },
        { endpoint: `/api/reports/revenue?clinicId=${clinicId}&period=month` }
      ])

      // Calculate total fixed costs
      let totalFixedCents = 0
      
      if (fixedCostsRes?.data) {
        const costs = Array.isArray(fixedCostsRes.data) ? fixedCostsRes.data : []
        totalFixedCents = costs.reduce((sum: number, cost: any) => 
          sum + (cost.amount_cents || 0), 0
        )
      }

      if (assetsRes?.data?.monthly_depreciation_cents) {
        totalFixedCents += assetsRes.data.monthly_depreciation_cents
      }

      // Get work days
      const workDays = timeRes?.data?.work_days || defaultWorkDays

      // Get current revenue
      const currentRevenueCents = revenueRes?.data?.total_cents || 0

      // Calculate equilibrium
      const calculations = EquilibriumCalculator.calculate(
        totalFixedCents,
        data.variableCostPercentage,
        workDays,
        safetyMarginPercentage
      )

      // Calculate progress
      const progress = EquilibriumCalculator.calculateProgress(
        currentRevenueCents,
        calculations.monthlyTargetCents || 0,
        calculations.dailyTargetCents || 0
      )

      setData(prev => ({
        ...prev,
        fixedCostsCents: totalFixedCents,
        workDays,
        currentRevenueCents,
        ...calculations,
        ...progress
      }))

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error loading equilibrium data'
      setError(errorMsg)
      console.error('Error loading equilibrium:', err)
    } finally {
      setLoading(false)
    }
  }, [clinicId, data.variableCostPercentage, defaultWorkDays, safetyMarginPercentage, fetchAll])

  // Update handlers
  const updateWorkDays = useCallback((days: number) => {
    setData(prev => {
      const calculations = EquilibriumCalculator.calculate(
        prev.fixedCostsCents,
        prev.variableCostPercentage,
        days,
        safetyMarginPercentage
      )
      
      const progress = EquilibriumCalculator.calculateProgress(
        prev.currentRevenueCents,
        calculations.monthlyTargetCents || 0,
        calculations.dailyTargetCents || 0
      )

      return {
        ...prev,
        workDays: days,
        ...calculations,
        ...progress
      }
    })
  }, [safetyMarginPercentage])

  const updateVariableCostPercentage = useCallback((percentage: number) => {
    setData(prev => {
      const calculations = EquilibriumCalculator.calculate(
        prev.fixedCostsCents,
        percentage,
        prev.workDays,
        safetyMarginPercentage
      )
      
      const progress = EquilibriumCalculator.calculateProgress(
        prev.currentRevenueCents,
        calculations.monthlyTargetCents || 0,
        calculations.dailyTargetCents || 0
      )

      return {
        ...prev,
        variableCostPercentage: percentage,
        ...calculations,
        ...progress
      }
    })
  }, [safetyMarginPercentage])

  const updateCurrentRevenue = useCallback((cents: number) => {
    setData(prev => {
      const progress = EquilibriumCalculator.calculateProgress(
        cents,
        prev.monthlyTargetCents,
        prev.dailyTargetCents
      )

      return {
        ...prev,
        currentRevenueCents: cents,
        ...progress
      }
    })
  }, [])

  // Save settings using useApi
  const saveSettings = useCallback(async () => {
    if (!clinicId) return

    try {
      const response = await fetch(`/api/settings/equilibrium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          work_days: data.workDays,
          variable_cost_percentage: data.variableCostPercentage,
          safety_margin_percentage: safetyMarginPercentage
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save settings')
      }
      
      // Refetch data after save
      await loadData()
    } catch (err) {
      console.error('Error saving settings:', err)
      throw err
    }
  }, [clinicId, data.workDays, data.variableCostPercentage, safetyMarginPercentage, loadData])

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    data,
    loading,
    error,
    updateWorkDays,
    updateVariableCostPercentage,
    updateCurrentRevenue,
    refreshData: loadData,
    saveSettings
  }
}