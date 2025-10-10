'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useApi } from '@/hooks/use-api'
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
  const draftRef = useRef<TimeSettings>({ work_days: 0, hours_per_day: 0, real_pct: 0 })
  
  // Resolve clinicId robustly: prop -> cookie -> localStorage
  const resolvedClinicId = useMemo(() => {
    if (clinicId) return clinicId
    try {
      if (typeof document !== 'undefined') {
        const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/)
        if (m) return decodeURIComponent(m[1])
      }
      if (typeof localStorage !== 'undefined') {
        const ls = localStorage.getItem('selectedClinicId')
        if (ls) return ls
      }
    } catch {}
    return undefined
  }, [clinicId])

  // Use API hooks for fetching related data
  const settingsApi = useApi<{ data: TimeSettings }>(
    resolvedClinicId ? `/api/settings/time?clinicId=${resolvedClinicId}` : null,
    { autoFetch: autoLoad && !!resolvedClinicId }
  )
  
  const fixedCostsApi = useApi<{ data: any[] }>(
    resolvedClinicId ? `/api/fixed-costs?clinicId=${resolvedClinicId}` : null,
    { autoFetch: autoLoad && !!resolvedClinicId }
  )
  
  const assetsApi = useApi<{ data: { monthly_depreciation_cents: number } }>(
    resolvedClinicId ? `/api/assets/summary?clinicId=${resolvedClinicId}` : null,
    { autoFetch: autoLoad && !!resolvedClinicId }
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
      const nextSettings: TimeSettings = {
        work_days: apiSettings.work_days,
        hours_per_day: apiSettings.hours_per_day,
        real_pct: Math.round((apiSettings.real_pct || 0) * 100)
      }
      try { console.log('[useTimeSettings] loaded from API', apiSettings) } catch {}
      setSettings(nextSettings)
      draftRef.current = nextSettings
      setHasRecord(true)
    } else {
      setHasRecord(false)
    }
  }, [settingsApi.data])
  
  // Update settings locally
  const updateSettings = useCallback((newSettings: Partial<TimeSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings }
      draftRef.current = next
      return next
    })
  }, [])
  
  // Save settings to backend
  const saveSettings = useCallback(async (payload?: Partial<TimeSettings>): Promise<boolean> => {
    const cid = resolvedClinicId
    if (!cid) {
      toast.error(t('settings.no_clinic_selected'))
      return false
    }

    const base = draftRef.current
    const draft: TimeSettings = {
      work_days: base.work_days,
      hours_per_day: base.hours_per_day,
      real_pct: base.real_pct
    }

    if (payload) {
      if (typeof payload.work_days === 'number') draft.work_days = payload.work_days
      if (typeof payload.hours_per_day === 'number') draft.hours_per_day = payload.hours_per_day
      if (typeof payload.real_pct === 'number') draft.real_pct = payload.real_pct
    }

    try {
      const response = await fetch('/api/settings/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          work_days: Number(draft.work_days) || 0,
          hours_per_day: Number(draft.hours_per_day) || 0,
          real_pct: Math.max(0, Number(draft.real_pct) || 0) / 100,
          clinic_id: cid
        })
      })

      if (response.ok) {
        toast.success(t('settings.saved_successfully'))
        draftRef.current = draft
        // Refresh settings after save
        await settingsApi.get()
        return true
      } else {
        const errorPayload = await response.json().catch(() => ({})) as { message?: string }
        toast.error(errorPayload?.message || t('settings.save_error'))
        return false
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving settings'
      toast.error(errorMsg)
      return false
    }
  }, [resolvedClinicId, settings, t, settingsApi])
  
  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([
      settingsApi.get(),
      fixedCostsApi.get(),
      assetsApi.get()
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

