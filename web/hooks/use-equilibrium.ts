'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParallelApi } from '@/hooks/use-api'
import {
  calculateCurrentMonthWorkingDays,
  getDefaultWorkingDaysConfig,
  type WorkingDaysConfig
} from '@/lib/calc/dates'

export interface EquilibriumData {
  fixedCostsCents: number
  variableCostPercentage: number
  autoVariableCostPercentage: number
  autoVariableCostSampleSize: number
  autoVariableCostPeriod?: { from: string; to: string; days: number }
  variableCostSource: 'calculated' | 'fallback'
  contributionMargin: number
  breakEvenRevenueCents: number
  dailyTargetCents: number
  safetyMarginCents: number
  safetyMarginPercentage: number
  customSafetyMarginPercentage: number
  workDays: number
  baseWorkDays: number
  baseSafetyMarginPercentage: number
  monthlyTargetCents: number
  manualMonthlyTargetCents: number
  baseMonthlyTargetCents: number
  currentRevenueCents: number
  revenueGapCents: number
  daysToBreakEven: number
  progressPercentage: number
  // New fields for smart working days
  actualDaysWorked: number
  totalWorkDaysInPeriod: number
  elapsedDays: number
  remainingWorkingDays: number
}

interface UseEquilibriumOptions {
  clinicId?: string
  defaultWorkDays?: number
  defaultVariableCostPercentage?: number
  safetyMarginPercentage?: number
}

interface SimulationSettings {
  workDays?: number
  variableCostPercentage?: number
  safetyMarginPercentage?: number
  manualMonthlyTargetPesos?: number | null
}

export class EquilibriumCalculator {
  static calculate(
    fixedCostsCents: number,
    variableCostPercentage: number,
    workDays: number,
    safetyMarginPercentage: number = 20,
    manualMonthlyTargetCents?: number
  ): Pick<
    EquilibriumData,
    | 'contributionMargin'
    | 'breakEvenRevenueCents'
    | 'dailyTargetCents'
    | 'safetyMarginCents'
    | 'safetyMarginPercentage'
    | 'monthlyTargetCents'
  > {
    const contributionMargin = Math.max(0, 100 - variableCostPercentage)
    const marginDecimal = contributionMargin / 100

    const breakEvenRevenueCents =
      marginDecimal > 0 ? Math.round(fixedCostsCents / marginDecimal) : 0

    const defaultMonthlyTargetCents = Math.round(
      breakEvenRevenueCents * (1 + Math.max(0, safetyMarginPercentage) / 100)
    )

    const manualTarget =
      manualMonthlyTargetCents && manualMonthlyTargetCents > 0
        ? manualMonthlyTargetCents
        : undefined

    const monthlyTargetCents = manualTarget
      ? Math.max(breakEvenRevenueCents, manualTarget)
      : defaultMonthlyTargetCents

    const safetyMarginCents = Math.max(0, monthlyTargetCents - breakEvenRevenueCents)
    const effectiveSafetyMarginPercentage =
      breakEvenRevenueCents > 0
        ? (safetyMarginCents / breakEvenRevenueCents) * 100
        : 0

    const dailyTargetCents =
      workDays > 0 ? Math.round(monthlyTargetCents / workDays) : 0

    return {
      contributionMargin,
      breakEvenRevenueCents,
      dailyTargetCents,
      safetyMarginCents,
      safetyMarginPercentage: effectiveSafetyMarginPercentage,
      monthlyTargetCents
    }
  }

  static calculateProgress(
    currentRevenueCents: number,
    targetRevenueCents: number,
    dailyTargetCents: number,
    actualDaysWorked?: number
  ): {
    revenueGapCents: number
    daysToBreakEven: number
    progressPercentage: number
  } {
    const revenueGapCents = Math.max(0, targetRevenueCents - currentRevenueCents)

    // Calculate days to break even based on ACTUAL current pace, not ideal target
    let daysToBreakEven = 0
    if (actualDaysWorked && actualDaysWorked > 0) {
      const currentDailyRevenue = currentRevenueCents / actualDaysWorked
      if (currentDailyRevenue > 0) {
        daysToBreakEven = Math.ceil(revenueGapCents / currentDailyRevenue)
      } else {
        // No revenue yet, use ideal target as reference
        daysToBreakEven = dailyTargetCents > 0 ? Math.ceil(revenueGapCents / dailyTargetCents) : 0
      }
    } else {
      // Fallback to ideal target if no actual days data
      daysToBreakEven = dailyTargetCents > 0 ? Math.ceil(revenueGapCents / dailyTargetCents) : 0
    }

    const progressPercentage =
      targetRevenueCents > 0
        ? Math.min(100, (currentRevenueCents / targetRevenueCents) * 100)
        : 0

    return { revenueGapCents, daysToBreakEven, progressPercentage }
  }
}

interface IEquilibriumOperations {
  data: EquilibriumData
  loading: boolean
  error: string | null
  simulate: (settings: Partial<SimulationSettings>) => void
  resetSimulation: () => void
  refreshData: () => Promise<void>
}

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
    autoVariableCostPercentage: defaultVariableCostPercentage,
    autoVariableCostSampleSize: 0,
    variableCostSource: 'fallback',
    contributionMargin: 65,
    breakEvenRevenueCents: 0,
    dailyTargetCents: 0,
    safetyMarginCents: 0,
    safetyMarginPercentage,
    customSafetyMarginPercentage: safetyMarginPercentage,
    workDays: defaultWorkDays,
    baseWorkDays: defaultWorkDays,
    baseSafetyMarginPercentage: safetyMarginPercentage,
    monthlyTargetCents: 0,
    manualMonthlyTargetCents: 0,
    baseMonthlyTargetCents: 0,
    currentRevenueCents: 0,
    revenueGapCents: 0,
    daysToBreakEven: 0,
    progressPercentage: 0,
    actualDaysWorked: 0,
    totalWorkDaysInPeriod: defaultWorkDays,
    elapsedDays: 0,
    remainingWorkingDays: defaultWorkDays
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fetchAll } = useParallelApi()

  const loadData = useCallback(async () => {
    if (!clinicId) {
      setError('common.noClinicContext')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [
        fixedCostsRes,
        assetsRes,
        timeRes,
        revenueRes,
        variableCostRes
      ] = await fetchAll([
        { endpoint: `/api/fixed-costs?clinicId=${clinicId}` },
        { endpoint: `/api/assets/summary?clinicId=${clinicId}` },
        { endpoint: `/api/settings/time?clinicId=${clinicId}` },
        { endpoint: `/api/reports/revenue?clinicId=${clinicId}&period=month` },
        { endpoint: `/api/equilibrium/variable-cost?clinicId=${clinicId}` }
      ])

      const toArray = (input: any): any[] => {
        if (Array.isArray(input)) return input
        if (Array.isArray(input?.data)) return input.data
        if (Array.isArray(input?.data?.data)) return input.data.data
        return []
      }

      const toObject = (input: any): Record<string, any> => {
        if (!input || Array.isArray(input)) return {}
        if (input.data && !Array.isArray(input.data)) return input.data
        return input
      }

      const fixedCosts = toArray(fixedCostsRes).map((cost: any) => ({
        amount_cents: Number(cost?.amount_cents || cost?.amount || 0)
      }))

      const assetsSummary = toObject(assetsRes)

      const manualFixedCents = fixedCosts.reduce(
        (sum, cost) => sum + Number(cost.amount_cents || 0),
        0
      )

      const assetsDepreciation = Number(
        assetsSummary?.monthly_depreciation_cents ??
          assetsSummary?.data?.monthly_depreciation_cents ??
          0
      )

      const totalFixedCents = manualFixedCents + assetsDepreciation
      const timeSettings = toObject(timeRes)
      const workDays =
        Number(timeSettings?.work_days ?? defaultWorkDays) || defaultWorkDays

      // Calculate real working days based on config
      const workingDaysConfig: WorkingDaysConfig =
        timeSettings?.working_days_config || getDefaultWorkingDaysConfig()

      const workingDaysResult = calculateCurrentMonthWorkingDays(workingDaysConfig)

      const revenuePayload = toObject(revenueRes)
      const currentRevenueCents = Number(
        revenuePayload?.revenue?.current ??
          revenuePayload?.data?.revenue?.current ??
          0
      )

      const variableCostData = toObject(variableCostRes)
      const calculatedVariableCostPercentage = Number(
        variableCostData?.variableCostPercentage ??
          variableCostData?.data?.variableCostPercentage ??
          0
      )
      const sampleSize = Number(
        variableCostData?.sampleSize ?? variableCostData?.data?.sampleSize ?? 0
      )
      const autoVariableCostPercentage =
        sampleSize > 0
          ? calculatedVariableCostPercentage
          : defaultVariableCostPercentage

      const calculations = EquilibriumCalculator.calculate(
        totalFixedCents,
        autoVariableCostPercentage,
        workDays,
        safetyMarginPercentage
      )

      const progress = EquilibriumCalculator.calculateProgress(
        currentRevenueCents,
        calculations.monthlyTargetCents ?? 0,
        calculations.dailyTargetCents ?? 0,
        workingDaysResult.elapsedWorkingDays
      )

      setData({
        fixedCostsCents: totalFixedCents,
        variableCostPercentage: autoVariableCostPercentage,
        autoVariableCostPercentage,
        autoVariableCostSampleSize: sampleSize,
        autoVariableCostPeriod: variableCostData?.period,
        variableCostSource: sampleSize > 0 ? 'calculated' : 'fallback',
        contributionMargin: calculations.contributionMargin ?? 0,
        breakEvenRevenueCents: calculations.breakEvenRevenueCents ?? 0,
        dailyTargetCents: calculations.dailyTargetCents ?? 0,
        safetyMarginCents: calculations.safetyMarginCents ?? 0,
        safetyMarginPercentage: calculations.safetyMarginPercentage ?? 0,
        customSafetyMarginPercentage: safetyMarginPercentage,
        workDays,
        baseWorkDays: workDays,
        baseSafetyMarginPercentage: safetyMarginPercentage,
        monthlyTargetCents: calculations.monthlyTargetCents ?? 0,
        manualMonthlyTargetCents: 0,
        baseMonthlyTargetCents: calculations.monthlyTargetCents ?? 0,
        currentRevenueCents,
        revenueGapCents: progress.revenueGapCents,
        daysToBreakEven: progress.daysToBreakEven,
        progressPercentage: progress.progressPercentage,
        actualDaysWorked: workingDaysResult.elapsedWorkingDays,
        totalWorkDaysInPeriod: workingDaysResult.workingDays,
        elapsedDays: workingDaysResult.elapsedDays,
        remainingWorkingDays: workingDaysResult.remainingWorkingDays
      })
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Error loading equilibrium data'
      setError(errorMsg)
      console.error('Error loading equilibrium:', err)
    } finally {
      setLoading(false)
    }
  }, [
    clinicId,
    defaultVariableCostPercentage,
    defaultWorkDays,
    safetyMarginPercentage,
    fetchAll
  ])

  const simulate = useCallback((settings: Partial<SimulationSettings>) => {
    setData(prev => {
      const workDays =
        settings.workDays !== undefined ? settings.workDays : prev.workDays
      const variableCostPercentage =
        settings.variableCostPercentage !== undefined
          ? settings.variableCostPercentage
          : prev.variableCostPercentage
      const customSafetyMarginPercentage =
        settings.safetyMarginPercentage !== undefined
          ? settings.safetyMarginPercentage
          : prev.customSafetyMarginPercentage

      const manualMonthlyTargetCents =
        settings.manualMonthlyTargetPesos !== undefined
          ? Math.max(
              0,
              Math.round((settings.manualMonthlyTargetPesos || 0) * 100)
            )
          : prev.manualMonthlyTargetCents

      const calculations = EquilibriumCalculator.calculate(
        prev.fixedCostsCents,
        variableCostPercentage,
        workDays,
        customSafetyMarginPercentage,
        manualMonthlyTargetCents > 0 ? manualMonthlyTargetCents : undefined
      )

      const progress = EquilibriumCalculator.calculateProgress(
        prev.currentRevenueCents,
        calculations.monthlyTargetCents ?? 0,
        calculations.dailyTargetCents ?? 0,
        prev.actualDaysWorked
      )

      return {
        ...prev,
        workDays,
        variableCostPercentage,
        customSafetyMarginPercentage,
        manualMonthlyTargetCents,
        contributionMargin:
          calculations.contributionMargin ?? prev.contributionMargin,
        breakEvenRevenueCents:
          calculations.breakEvenRevenueCents ?? prev.breakEvenRevenueCents,
        dailyTargetCents:
          calculations.dailyTargetCents ?? prev.dailyTargetCents,
        safetyMarginCents:
          calculations.safetyMarginCents ?? prev.safetyMarginCents,
        safetyMarginPercentage:
          calculations.safetyMarginPercentage ?? prev.safetyMarginPercentage,
        monthlyTargetCents:
          calculations.monthlyTargetCents ?? prev.monthlyTargetCents,
        revenueGapCents: progress.revenueGapCents,
        daysToBreakEven: progress.daysToBreakEven,
        progressPercentage: progress.progressPercentage
      }
    })
  }, [])

  const resetSimulation = useCallback(() => {
    setData(prev => {
      const calculations = EquilibriumCalculator.calculate(
        prev.fixedCostsCents,
        prev.autoVariableCostPercentage,
        prev.baseWorkDays,
        prev.baseSafetyMarginPercentage
      )

      const progress = EquilibriumCalculator.calculateProgress(
        prev.currentRevenueCents,
        calculations.monthlyTargetCents ?? 0,
        calculations.dailyTargetCents ?? 0,
        prev.actualDaysWorked
      )

      return {
        ...prev,
        workDays: prev.baseWorkDays,
        variableCostPercentage: prev.autoVariableCostPercentage,
        customSafetyMarginPercentage: prev.baseSafetyMarginPercentage,
        manualMonthlyTargetCents: 0,
        contributionMargin:
          calculations.contributionMargin ?? prev.contributionMargin,
        breakEvenRevenueCents:
          calculations.breakEvenRevenueCents ?? prev.breakEvenRevenueCents,
        dailyTargetCents:
          calculations.dailyTargetCents ?? prev.dailyTargetCents,
        safetyMarginCents:
          calculations.safetyMarginCents ?? prev.safetyMarginCents,
        safetyMarginPercentage:
          calculations.safetyMarginPercentage ?? prev.safetyMarginPercentage,
        monthlyTargetCents:
          calculations.monthlyTargetCents ?? prev.monthlyTargetCents,
        revenueGapCents: progress.revenueGapCents,
        daysToBreakEven: progress.daysToBreakEven,
        progressPercentage: progress.progressPercentage
      }
    })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    data,
    loading,
    error,
    simulate,
    resetSimulation,
    refreshData: loadData
  }
}
