'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { useCrudOperations } from '@/hooks/use-crud-operations'
import { calculateTimeCosts } from '@/lib/calc/tiempo'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export interface TimeSettings {
  work_days: number
  hours_per_day: number
  real_pct: number
  created_at?: string
  updated_at?: string
}

export interface TimeCalculations {
  hoursMonth: number
  hoursYear: number
  minutesMonth: number
  minutesYear: number
  realHoursMonth: number
  realHoursYear: number
  realMinutesMonth: number
  realMinutesYear: number
  fixedCostPerMinuteCents: number
  fixedCostPerHourCents: number
}

interface UseTimeSettingsOptions {
  clinicId?: string
  autoLoad?: boolean
}

export function useTimeSettings(options: UseTimeSettingsOptions = {}) {
  const { clinicId, autoLoad = true } = options
  const t = useTranslations()
  
  const [settings, setSettings] = useState<TimeSettings>({
    work_days: 20,
    hours_per_day: 7,
    real_pct: 80
  })
  
  // Use API hooks for fetching related data
  const settingsApi = useApi<{ data: TimeSettings }>(
    clinicId ? `/api/settings/time?clinicId=${clinicId}` : null,
    { autoFetch: autoLoad && !!clinicId }
  )
  
  const fixedCostsApi = useApi<{ data: any[] }>(
    clinicId ? `/api/fixed-costs?clinicId=${clinicId}` : null,
    { autoFetch: autoLoad && !!clinicId }
  )
  
  const assetsApi = useApi<{ data: { monthly_depreciation_cents: number } }>(
    clinicId ? `/api/assets/summary?clinicId=${clinicId}` : null,
    { autoFetch: autoLoad && !!clinicId }
  )
  
  // Extract data from API responses
  const fixedCosts = fixedCostsApi.data?.data || []
  const assetsDepreciation = assetsApi.data?.data?.monthly_depreciation_cents || 0
  
  // Calculate total fixed costs using memoization
  const totalFixedCosts = useMemo(() => {
    return fixedCosts.reduce((sum, cost) => 
      sum + (cost.amount_cents || 0), 0
    ) + assetsDepreciation
  }, [fixedCosts, assetsDepreciation])
  
  // Calculate time metrics using memoization
  const calculations = useMemo((): TimeCalculations => {
    if (!settings || totalFixedCosts === 0) {
      return {
        hoursMonth: 0,
        hoursYear: 0,
        minutesMonth: 0,
        minutesYear: 0,
        realHoursMonth: 0,
        realHoursYear: 0,
        realMinutesMonth: 0,
        realMinutesYear: 0,
        fixedCostPerMinuteCents: 0,
        fixedCostPerHourCents: 0
      }
    }
    
    const result = calculateTimeCosts(
      totalFixedCosts,
      settings.work_days,
      settings.hours_per_day,
      settings.real_pct / 100 // Convert percentage to decimal
    )
    
    return {
      hoursMonth: result.horasTrabajoMes,
      hoursYear: result.horasTrabajoAno,
      minutesMonth: result.minutosTrabajoMes,
      minutesYear: result.minutosTrabajoAno,
      realHoursMonth: result.horasProductivasMes,
      realHoursYear: result.horasProductivasAno,
      realMinutesMonth: result.minutosProductivosMes,
      realMinutesYear: result.minutosProductivosAno,
      fixedCostPerMinuteCents: result.costoFijoPorMinuto,
      fixedCostPerHourCents: result.costoFijoPorMinuto * 60
    }
  }, [settings, totalFixedCosts])
  
  // Update settings from API response
  useEffect(() => {
    if (settingsApi.data?.data) {
      const apiSettings = settingsApi.data.data
      setSettings({
        work_days: apiSettings.work_days,
        hours_per_day: apiSettings.hours_per_day,
        real_pct: Math.round((apiSettings.real_pct || 0.8) * 100)
      })
    }
  }, [settingsApi.data])
  
  // Update settings locally
  const updateSettings = useCallback((newSettings: Partial<TimeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])
  
  // Save settings to backend
  const saveSettings = useCallback(async (): Promise<boolean> => {
    if (!clinicId) {
      toast.error(t('settings.no_clinic_selected'))
      return false
    }
    
    try {
      const response = await fetch('/api/settings/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          clinic_id: clinicId,
          real_pct_decimal: settings.real_pct / 100
        })
      })
      
      if (response.ok) {
        toast.success(t('settings.saved_successfully'))
        // Refresh settings after save
        await settingsApi.refetch()
        return true
      } else {
        toast.error(t('settings.save_error'))
        return false
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving settings'
      toast.error(errorMsg)
      return false
    }
  }, [clinicId, settings, t, settingsApi])
  
  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([
      settingsApi.refetch(),
      fixedCostsApi.refetch(),
      assetsApi.refetch()
    ])
  }, [settingsApi, fixedCostsApi, assetsApi])
  
  // Determine loading state
  const loading = settingsApi.loading || fixedCostsApi.loading || assetsApi.loading
  
  // Combine errors
  const error = settingsApi.error || fixedCostsApi.error || assetsApi.error || null
  
  return {
    // Data
    settings,
    calculations,
    fixedCosts,
    assetsDepreciation,
    totalFixedCosts,
    
    // State
    loading,
    error,
    
    // Operations
    updateSettings,
    saveSettings,
    refreshData
  }
}