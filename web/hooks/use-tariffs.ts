'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ServiceWithCost } from '@/lib/types'
import { calcularPrecioFinal } from '@/lib/calc/tarifa'
import { redondearA } from '@/lib/money'
import { useApi } from '@/hooks/use-api'

export interface TariffRow extends ServiceWithCost {
  margin_pct: number
  category?: string
  final_price: number
  rounded_price: number
  stored_price_cents?: number | null
  stored_margin_pct?: number | null
}

interface UseTariffsOptions {
  clinicId?: string
  defaultMargin?: number
  defaultRoundTo?: number
  autoLoad?: boolean
}

interface StoredTariff {
  service_id: string
  clinic_id: string
  margin_pct: number
  price_cents: number
  rounded_price_cents: number
  fixed_cost_per_minute_cents: number
  variable_cost_cents: number
  is_active: boolean
}

const normalizeList = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (value && Array.isArray((value as any).data)) return (value as any).data as T[]
  return []
}

export function useTariffs(options: UseTariffsOptions = {}) {
  const { clinicId, defaultMargin = 30, defaultRoundTo = 10, autoLoad = true } = options
  const t = useTranslations()
  
  const [margin, setMargin] = useState(defaultMargin)
  const [roundTo, setRoundTo] = useState(defaultRoundTo)
  const [localMargins, setLocalMargins] = useState<Record<string, number>>({})
  
  // Resolve clinic id robustly: prop -> cookie -> localStorage
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
  
  const shouldFetch = autoLoad && !!resolvedClinicId
  const servicesApi = useApi<{ data: ServiceWithCost[] }>(
    resolvedClinicId ? `/api/services?clinicId=${resolvedClinicId}` : null,
    { autoFetch: shouldFetch }
  )
  const tariffsApi = useApi<{ data: StoredTariff[] }>(
    resolvedClinicId ? `/api/tariffs?clinicId=${resolvedClinicId}` : null,
    { autoFetch: shouldFetch }
  )
  
  const storedTariffsByService = useMemo(() => {
    const data = normalizeList<StoredTariff>(tariffsApi.data)
    return new Map<string, StoredTariff>(data.map(row => [row.service_id, row]))
  }, [tariffsApi.data])
  
  const tariffs = useMemo((): TariffRow[] => {
    const services = normalizeList<ServiceWithCost>(servicesApi.data)
    
    return services.map(service => {
      const stored = storedTariffsByService.get(service.id)
      const storedMargin = stored ? Number(stored.margin_pct) : null
      const serviceMarginPct = service.margin_pct ? Number(service.margin_pct) : null
      const serviceMargin = localMargins[service.id] ?? storedMargin ?? serviceMarginPct ?? margin
      const totalCost = (service.fixed_cost_cents || 0) + (service.variable_cost_cents || 0)
      const calculatedFinalPrice = calcularPrecioFinal(totalCost, serviceMargin)
      const calculatedRounded = redondearA(calculatedFinalPrice, roundTo * 100)

      return {
        ...service,
        margin_pct: serviceMargin,
        final_price: stored?.price_cents ?? calculatedFinalPrice,
        rounded_price: stored?.rounded_price_cents ?? calculatedRounded,
        stored_price_cents: stored?.price_cents ?? null,
        stored_margin_pct: storedMargin,
      }
    })
  }, [servicesApi.data, storedTariffsByService, localMargins, margin, roundTo])
  
  const updateMargin = useCallback((serviceId: string, newMargin: number) => {
    setLocalMargins(prev => ({
      ...prev,
      [serviceId]: newMargin
    }))
  }, [])
  
  const updateAllMargins = useCallback((newMargin: number) => {
    setMargin(newMargin)
    setLocalMargins({})
  }, [])
  
  const updateRounding = useCallback((newRoundTo: number) => {
    setRoundTo(newRoundTo)
  }, [])
  
  const saveTariffs = useCallback(async () => {
    if (!resolvedClinicId) {
      toast.error(t('settings.no_clinic_selected'))
      return
    }

    if (!tariffs.length) {
      toast.error(t('tariffs.no_services_to_save'))
      return
    }

    try {
      const tariffData = tariffs.map(tariff => ({
        service_id: tariff.id,
        clinic_id: resolvedClinicId!,
        margin_percentage: tariff.margin_pct,
        final_price_cents: tariff.rounded_price,
        is_active: true
      }))
      
      const response = await fetch('/api/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tariffs: tariffData })
      })
      
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.message || 'Failed to save tariffs'
        throw new Error(message)
      }
      
      toast.success(t('tariffs.saved_successfully'))
      await tariffsApi.get()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving tariffs'
      toast.error(errorMsg)
      throw err
    }
  }, [resolvedClinicId, tariffs, t, tariffsApi])
  
  const refreshTariffs = useCallback(async () => {
    await Promise.all([
      servicesApi.get(),
      tariffsApi.get()
    ])
  }, [servicesApi, tariffsApi])
  
  return {
    tariffs,
    loading: servicesApi.loading || tariffsApi.loading,
    error: servicesApi.error || tariffsApi.error,
    margin,
    roundTo,
    updateMargin,
    updateAllMargins,
    updateRounding,
    saveTariffs,
    refreshTariffs
  }
}
