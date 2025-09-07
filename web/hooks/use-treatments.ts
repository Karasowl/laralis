'use client'

import { useCallback, useMemo, useEffect } from 'react'
import { useCrudOperations } from './use-crud-operations'
import { useApi } from './use-api'
import { useParallelApi } from './use-api'

export interface Patient {
  id: string
  first_name: string
  last_name: string
}

export interface Service {
  id: string
  name: string
  variable_cost_cents: number
  est_minutes?: number
}

export interface Treatment {
  id: string
  clinic_id: string
  patient_id: string
  patient?: Patient
  service_id: string
  service?: Service
  treatment_date: string
  minutes: number
  fixed_per_minute_cents: number
  variable_cost_cents: number
  margin_pct: number
  price_cents: number
  tariff_version?: number
  status: 'pending' | 'completed' | 'cancelled'
  notes?: string
  snapshot_costs?: any
  created_at: string
  updated_at: string
}

interface UseTreatmentsOptions {
  clinicId?: string
  autoLoad?: boolean
}

export function useTreatments(options: UseTreatmentsOptions = {}) {
  const { clinicId, autoLoad = true } = options
  
  // Use generic CRUD for treatments
  const crud = useCrudOperations<Treatment>({
    endpoint: '/api/treatments',
    entityName: 'Treatment',
    includeClinicId: true
  })

  // Use API hooks for related data
  // Note: useApi unwraps {data} responses, so the generic should be Patient[]
  const patientsApi = useApi<Patient[]>('/api/patients')
  const servicesApi = useApi<Service[]>('/api/services')
  const timeSettingsApi = useApi<{ data: { fixed_per_minute_cents: number } }>('/api/settings/time')

  // Use parallel API for initial load
  const { fetchAll } = useParallelApi()

  // Auto-load related lists on mount if requested
  useEffect(() => {
    if (autoLoad) {
      patientsApi.get()
      servicesApi.get()
      timeSettingsApi.get()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad])

  // Calculate summary statistics using memoization
  const summary = useMemo(() => {
    const treatments = crud.items || []
    const totalRevenue = treatments.reduce((sum, t) => sum + t.price_cents, 0)
    const totalTreatments = treatments.length
    const completedTreatments = treatments.filter(t => t.status === 'completed').length
    const pendingTreatments = treatments.filter(t => t.status === 'pending').length
    const averagePrice = totalTreatments > 0 ? totalRevenue / totalTreatments : 0

    return {
      totalRevenue,
      totalTreatments,
      completedTreatments,
      pendingTreatments,
      averagePrice,
      completionRate: totalTreatments > 0 ? (completedTreatments / totalTreatments) * 100 : 0
    }
  }, [crud.items])

  // Load all related data in parallel
  const loadRelatedData = useCallback(async () => {
    await fetchAll([
      { endpoint: '/api/patients' },
      { endpoint: '/api/services' },
      { endpoint: '/api/settings/time' }
    ])
  }, [fetchAll])

  // Enhanced create with snapshot logic
  const createTreatment = useCallback(async (data: any): Promise<boolean> => {
    // Get current time settings if not loaded
    if (!timeSettingsApi.data) {
      await timeSettingsApi.get()
    }
    
    const services = servicesApi.data || []
    const selectedService = services.find(s => s.id === data.service_id)
    
    if (!selectedService) {
      return false
    }

    // Calculate snapshot costs
    const fixedPerMinuteCents = timeSettingsApi.data?.data?.fixed_per_minute_cents || 0
    const variableCost = selectedService.variable_cost_cents || 0
    const fixedCost = fixedPerMinuteCents * data.minutes
    const totalCost = fixedCost + variableCost
    const price = Math.round(totalCost * (1 + data.margin_pct / 100))

    const treatmentData = {
      ...data,
      fixed_per_minute_cents: fixedPerMinuteCents,
      variable_cost_cents: variableCost,
      price_cents: price,
      tariff_version: 1,
      snapshot_costs: {
        fixed_cost_cents: fixedCost,
        variable_cost_cents: variableCost,
        total_cost_cents: totalCost,
        margin_pct: data.margin_pct,
        price_cents: price,
        tariff_version: 1
      }
    }

    return await crud.handleCreate(treatmentData)
  }, [crud, servicesApi.data, timeSettingsApi])

  // Enhanced update with snapshot preservation
  const updateTreatment = useCallback(async (
    id: string, 
    data: any, 
    existingTreatment: Treatment
  ): Promise<boolean> => {
    const services = servicesApi.data || []
    const selectedService = services.find(s => s.id === (data.service_id || existingTreatment.service_id))
    
    if (!selectedService) {
      return false
    }

    // Preserve existing snapshot values
    let fixedPerMinuteCents = existingTreatment.fixed_per_minute_cents
    let variableCost = existingTreatment.variable_cost_cents

    // Only update variable cost if service changed
    if (data.service_id && data.service_id !== existingTreatment.service_id) {
      variableCost = selectedService.variable_cost_cents || 0
    }

    // Recalculate price if any cost factor changed
    const minutes = data.minutes || existingTreatment.minutes
    const marginPct = data.margin_pct ?? existingTreatment.margin_pct
    const fixedCost = fixedPerMinuteCents * minutes
    const totalCost = fixedCost + variableCost
    const price = Math.round(totalCost * (1 + marginPct / 100))

    const treatmentData = {
      ...data,
      fixed_per_minute_cents: fixedPerMinuteCents,
      variable_cost_cents: variableCost,
      price_cents: price,
      tariff_version: existingTreatment.tariff_version || 1,
      snapshot_costs: {
        fixed_cost_cents: fixedCost,
        variable_cost_cents: variableCost,
        total_cost_cents: totalCost,
        margin_pct: marginPct,
        price_cents: price,
        tariff_version: existingTreatment.tariff_version || 1
      }
    }

    return await crud.handleUpdate(id, treatmentData)
  }, [crud, servicesApi.data])

  return {
    // From CRUD operations
    treatments: crud.items,
    loading: crud.loading || patientsApi.loading || servicesApi.loading,
    error: null,
    
    // Related data
    patients: patientsApi.data || [],
    services: servicesApi.data || [],
    timeSettings: timeSettingsApi.data?.data || { fixed_per_minute_cents: 0 },
    
    // Calculated data
    summary,
    
    // Operations
    fetchTreatments: crud.fetchItems,
    createTreatment,
    updateTreatment,
    deleteTreatment: crud.handleDelete,
    
    // Load related data
    loadRelatedData
  }
}
