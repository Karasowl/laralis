'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { useCrudOperations } from '@/hooks/use-crud-operations'
// Local simple calc to avoid coupling and ensure hours are shown even if costs=0
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
  
  const [settings, setSettings] = useState<TimeSettings>({ work_days: 0, hours_per_day: 0, real_pct: 0 })
  const [hasRecord, setHasRecord] = useState(false)
  
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
    const hoursMonth = (settings.work_days || 0) * (settings.hours_per_day || 0)
    const hoursYear = hoursMonth * 12
    const minutesMonth = hoursMonth * 60
    const minutesYear = hoursYear * 60
    const realPctDec = Math.max(0, Math.min(1, (settings.real_pct || 0) / 100))
    const realHoursMonth = Math.round(hoursMonth * realPctDec)
    const realHoursYear = Math.round(hoursYear * realPctDec)
    const realMinutesMonth = realHoursMonth * 60
    const realMinutesYear = realHoursYear * 60

    const fixedCostPerMinuteCents = minutesMonth > 0 && realPctDec > 0 && totalFixedCosts > 0
      ? Math.round(totalFixedCosts / (minutesMonth * realPctDec))
      : 0

    return {
      hoursMonth,
      hoursYear,
      minutesMonth,
      minutesYear,
      realHoursMonth,
      realHoursYear,
      realMinutesMonth,
      realMinutesYear,
      fixedCostPerMinuteCents,
      fixedCostPerHourCents: fixedCostPerMinuteCents * 60
    }
  }, [settings, totalFixedCosts])
  
  // Update settings from API response
  useEffect(() => {
    if (settingsApi.data?.data) {
      const apiSettings = settingsApi.data.data
      try { console.log('[useTimeSettings] loaded from API', apiSettings) } catch {}
      setSettings({
        work_days: apiSettings.work_days,
        hours_per_day: apiSettings.hours_per_day,
        real_pct: Math.round((apiSettings.real_pct || 0) * 100)
      })
      setHasRecord(true)
    } else {
      setHasRecord(false)
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
    hasRecord,
    
    // State
    loading,
    error,
    
    // Operations
    updateSettings,
    saveSettings,
    refreshData
  }
}
