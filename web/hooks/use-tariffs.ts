'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ServiceWithCost } from '@/lib/types'
import { calcularPrecioFinal } from '@/lib/calc/tarifa'
import { redondearA } from '@/lib/money'
import { useApi } from '@/hooks/use-api'

export interface TariffRow extends ServiceWithCost {
  margin_pct: number
  final_price: number
  rounded_price: number
}

interface UseTariffsOptions {
  clinicId?: string
  defaultMargin?: number
  defaultRoundTo?: number
  autoLoad?: boolean
}

export function useTariffs(options: UseTariffsOptions = {}) {
  const { clinicId, defaultMargin = 30, defaultRoundTo = 10, autoLoad = true } = options
  const t = useTranslations()
  
  const [margin, setMargin] = useState(defaultMargin)
  const [roundTo, setRoundTo] = useState(defaultRoundTo)
  const [localMargins, setLocalMargins] = useState<Record<string, number>>({})
  
  // Use API hook for fetching services
  const servicesApi = useApi<{ data: ServiceWithCost[] }>(
    clinicId ? `/api/services?clinicId=${clinicId}` : null,
    { autoFetch: autoLoad && !!clinicId }
  )
  
  // Calculate tariffs with memoization
  const tariffs = useMemo((): TariffRow[] => {
    const services = servicesApi.data?.data || []
    
    return services.map(service => {
      const serviceMargin = localMargins[service.id] ?? margin
      const totalCost = (service.fixed_cost_cents || 0) + (service.variable_cost_cents || 0)
      const finalPrice = calcularPrecioFinal(totalCost, serviceMargin)
      const roundedPrice = redondearA(finalPrice, roundTo * 100)
      
      return {
        ...service,
        margin_pct: serviceMargin,
        final_price: finalPrice,
        rounded_price: roundedPrice
      }
    })
  }, [servicesApi.data, margin, roundTo, localMargins])
  
  // Update margin for a specific service
  const updateMargin = useCallback((serviceId: string, newMargin: number) => {
    setLocalMargins(prev => ({
      ...prev,
      [serviceId]: newMargin
    }))
  }, [])
  
  // Update all margins
  const updateAllMargins = useCallback((newMargin: number) => {
    setMargin(newMargin)
    setLocalMargins({}) // Clear individual margins
  }, [])
  
  // Update rounding
  const updateRounding = useCallback((newRoundTo: number) => {
    setRoundTo(newRoundTo)
  }, [])
  
  // Save tariffs to backend
  const saveTariffs = useCallback(async () => {
    if (!clinicId) {
      toast.error(t('settings.no_clinic_selected'))
      return
    }
    
    try {
      const tariffData = tariffs.map(tariff => ({
        service_id: tariff.id,
        clinic_id: clinicId,
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
        throw new Error('Failed to save tariffs')
      }
      
      toast.success(t('tariffs.saved_successfully'))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error saving tariffs'
      toast.error(errorMsg)
      throw err
    }
  }, [clinicId, tariffs, t])
  
  // Refresh tariffs
  const refreshTariffs = useCallback(async () => {
    await servicesApi.refetch()
  }, [servicesApi])
  
  return {
    // Data
    tariffs,
    loading: servicesApi.loading,
    error: servicesApi.error,
    
    // Settings
    margin,
    roundTo,
    
    // Operations
    updateMargin,
    updateAllMargins,
    updateRounding,
    saveTariffs,
    refreshTariffs
  }
}