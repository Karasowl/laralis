'use client'

import { useCallback, useMemo, useEffect } from 'react'
import { useSwrCrud } from './use-swr-crud'
import { useApi } from './use-api'
import { useParallelApi } from './use-api'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

// Calendar sync result from API
interface CalendarSyncResult {
  success: boolean
  eventId?: string | null
  error?: {
    code: 'not_connected' | 'token_expired' | 'api_error' | 'invalid_status'
    message: string
  }
}

// Show toast based on calendar sync result
function showCalendarSyncToast(calendarSync: CalendarSyncResult | undefined, t: (key: string) => string) {
  if (!calendarSync) return

  if (calendarSync.success) {
    // Optional: show success toast (can be commented out if too noisy)
    // toast.success(t('settings.calendar.syncSuccess'))
  } else if (calendarSync.error) {
    // Show warning based on error code
    switch (calendarSync.error.code) {
      case 'not_connected':
        toast.warning(t('settings.calendar.syncNotConnected'), { duration: 5000 })
        break
      case 'token_expired':
        toast.warning(t('settings.calendar.syncTokenExpired'), { duration: 5000 })
        break
      case 'invalid_status':
        // Don't show for invalid status - this is expected behavior
        break
      case 'api_error':
        toast.error(t('settings.calendar.syncApiError'), { duration: 5000 })
        break
    }
  }
}

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
  treatment_time?: string
  minutes: number
  duration_minutes?: number
  fixed_per_minute_cents: number
  fixed_cost_per_minute_cents?: number
  variable_cost_cents: number
  margin_pct: number
  price_cents: number
  amount_paid_cents: number
  is_paid: boolean
  tariff_version?: number
  status: 'pending' | 'completed' | 'cancelled'
  notes?: string
  snapshot_costs?: any
  // Refund fields
  is_refunded?: boolean
  refunded_at?: string
  refund_reason?: string
  created_at: string
  updated_at: string
}

interface UseTreatmentsOptions {
  clinicId?: string
  autoLoad?: boolean
  patientId?: string
}

export function useTreatments(options: UseTreatmentsOptions = {}) {
  const { clinicId, autoLoad = true, patientId } = options
  const t = useTranslations()

  // Use SWR-based CRUD for treatments with caching
  const crud = useSwrCrud<Treatment>({
    endpoint: '/api/treatments',
    entityName: 'Treatment',
    includeClinicId: true,
    staticParams: patientId ? { patient_id: patientId } : undefined,
    revalidateOnFocus: true,
  })

  // Use API hooks for related data
  // Algunos endpoints devuelven { data: [...] }. Normalizamos a arrays.
  const patientsApi = useApi<any>('/api/patients')
  const servicesApi = useApi<any>('/api/services')
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
  const uniqueTreatments = useMemo(() => {
    const map = new Map<string, Treatment>();
    (crud.items || []).forEach(item => { if (item?.id) map.set(item.id, item); });
    return Array.from(map.values());
  }, [crud.items]);

  const summary = useMemo(() => {
    const treatments = uniqueTreatments || []
    const nonCancelled = treatments.filter(t => t.status !== 'cancelled')
    const completed = nonCancelled.filter(t => t.status === 'completed')

    const totalRevenue = completed.reduce((sum, t) => sum + (t.price_cents || 0), 0)
    const totalTreatments = nonCancelled.length // Excluye cancelados
    const completedTreatments = completed.length
    const pendingTreatments = nonCancelled.filter(t => t.status === 'pending').length
    const averagePrice = completedTreatments > 0 ? totalRevenue / completedTreatments : 0

    // Partial payments tracking
    const treatmentsWithBalance = completed.filter(t => !t.is_paid).length
    const pendingBalanceCents = completed
      .filter(t => !t.is_paid)
      .reduce((sum, t) => sum + ((t.price_cents || 0) - (t.amount_paid_cents || 0)), 0)

    return {
      totalRevenue,
      totalTreatments,
      completedTreatments,
      pendingTreatments,
      averagePrice,
      completionRate: totalTreatments > 0 ? (completedTreatments / totalTreatments) * 100 : 0,
      // Partial payments
      treatmentsWithBalance,
      pendingBalanceCents,
    }
  }, [uniqueTreatments])

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
    // Ensure we have time settings
    if (!timeSettingsApi.data) {
      await timeSettingsApi.get()
    }
    const fpm = Number((timeSettingsApi.data as any)?.data?.fixed_per_minute_cents || 0)

    // Try to find service; if not present (e.g., created just now), refresh once
    const listOnce = Array.isArray(servicesApi.data) ? servicesApi.data as Service[] : ((servicesApi.data as any)?.data ?? [])
    let selectedService = listOnce.find((s: Service) => s.id === data.service_id)
    if (!selectedService) {
      await servicesApi.get()
      const listTwice = Array.isArray(servicesApi.data) ? servicesApi.data as Service[] : ((servicesApi.data as any)?.data ?? [])
      selectedService = listTwice.find((s: Service) => s.id === data.service_id)
    }

    // Calculate snapshot costs with graceful fallback
    const fixedPerMinuteCents = timeSettingsApi.data?.data?.fixed_per_minute_cents || 0
    const variableCost = selectedService?.variable_cost_cents || 0
    const fixedCost = (Number(fpm) || 0) * data.minutes
    const totalCost = fixedCost + variableCost

    // Priority order for price calculation:
    // 1. User-specified sale_price (if provided, including explicit 0)
    // 2. Service default price_cents (includes discount)
    // 3. Calculate from costs + margin as fallback
    // CRITICAL: Check if sale_price is explicitly provided (even if 0), not just truthy
    const price = data.sale_price !== undefined && data.sale_price !== null
      ? Math.round(data.sale_price * 100) // Convert pesos → centavos
      : (selectedService?.price_cents || Math.round(totalCost * (1 + data.margin_pct / 100)))

    const snapshot = {
      // CamelCase snapshot for historical integrity (append-only)
      fixedPerMinuteCents: fixedPerMinuteCents,
      minutes: data.minutes,
      variableCostCents: variableCost,
      marginPct: data.margin_pct,
      priceCents: price,
      tariffVersion: 1,
      // Also include snake_case for backward/DB compatibility
      fixed_cost_cents: fixedCost,
      variable_cost_cents: variableCost,
      total_cost_cents: totalCost,
      price_cents: price,
      tariff_version: 1
    }

    const treatmentData = {
      ...data,
      fixed_per_minute_cents: fixedPerMinuteCents,
      variable_cost_cents: variableCost,
      price_cents: price,
      tariff_version: 1,
      snapshot_costs: snapshot
    }

    // Use fetch directly to access calendarSync from response
    try {
      const response = await fetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(treatmentData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || t('common.createError'))
        return false
      }

      const result = await response.json()

      // Show calendar sync toast if applicable
      showCalendarSyncToast(result.calendarSync, t)

      toast.success(t('common.createSuccess', { entity: 'Treatment' }))
      await crud.refresh()
      return true
    } catch (error) {
      console.error('Error creating treatment:', error)
      toast.error(t('common.createError'))
      return false
    }
  }, [crud, servicesApi, timeSettingsApi, t])

  // Enhanced update with snapshot preservation
  const updateTreatment = useCallback(async (
    id: string,
    data: any,
    existingTreatment: Treatment
  ): Promise<boolean> => {
    const services = Array.isArray(servicesApi.data) ? servicesApi.data as Service[] : ((servicesApi.data as any)?.data ?? [])
    const selectedService = services.find((s: Service) => s.id === (data.service_id || existingTreatment.service_id))

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

    // Calculate price based on user input or cost-based calculation
    const minutes = data.minutes || existingTreatment.minutes
    const marginPct = data.margin_pct ?? existingTreatment.margin_pct
    const fixedCost = fixedPerMinuteCents * minutes
    const totalCost = fixedCost + variableCost

    // BUG FIX: Check if service_id was explicitly provided AND is different
    // Previously: `data.service_id !== existingTreatment.service_id` was always true
    // when data.service_id was undefined (e.g., status-only updates)
    // This caused prices to be recalculated incorrectly on every update.
    const serviceChanged = data.service_id !== undefined &&
                           data.service_id !== existingTreatment.service_id

    // Priority order for price calculation:
    // 1. User-specified sale_price (if provided in update)
    // 2. Preserve existing price_cents if no changes to cost factors
    // 3. Recalculate from costs + margin ONLY if service, minutes, or margin changed
    const price = data.sale_price
      ? Math.round(data.sale_price * 100) // Convert pesos → centavos
      : (serviceChanged || data.minutes !== undefined || data.margin_pct !== undefined)
        ? Math.round(totalCost * (1 + marginPct / 100))
        : existingTreatment.price_cents

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

    // Use fetch directly to access calendarSync from response
    try {
      const response = await fetch(`/api/treatments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(treatmentData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || t('common.updateError'))
        return false
      }

      const result = await response.json()

      // Show calendar sync toast if applicable
      showCalendarSyncToast(result.calendarSync, t)

      toast.success(t('common.updateSuccess', { entity: 'Treatment' }))
      await crud.refresh()
      return true
    } catch (error) {
      console.error('Error updating treatment:', error)
      toast.error(t('common.updateError'))
      return false
    }
  }, [crud, servicesApi.data, t])

  // Register a payment for a treatment
  const registerPayment = useCallback(async (
    treatmentId: string,
    amountCents: number
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/treatments/${treatmentId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount_cents: amountCents }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.message || t('treatments.payment.paymentError'))
        return false
      }

      const result = await response.json()
      toast.success(result.message || t('treatments.payment.paymentSuccess'))
      await crud.refresh()
      return true
    } catch (error) {
      console.error('Error registering payment:', error)
      toast.error(t('treatments.payment.paymentError'))
      return false
    }
  }, [crud, t])

  return {
    // From CRUD operations
    treatments: uniqueTreatments,
    loading: crud.loading || patientsApi.loading || servicesApi.loading,
    isSubmitting: crud.isSubmitting,
    error: null,

    // Related data
    patients: Array.isArray(patientsApi.data)
      ? (patientsApi.data as Patient[])
      : ((patientsApi.data as any)?.data ?? []),
    services: Array.isArray(servicesApi.data)
      ? (servicesApi.data as Service[])
      : ((servicesApi.data as any)?.data ?? []),
    timeSettings: timeSettingsApi.data?.data || { fixed_per_minute_cents: 0 },

    // Calculated data
    summary,

    // Operations
    fetchTreatments: crud.refresh, // SWR uses refresh instead of fetchItems
    createTreatment,
    updateTreatment,
    deleteTreatment: crud.handleDelete,
    registerPayment,

    // SWR state
    isValidating: crud.isValidating,

    // Load related data
    loadRelatedData
  }
}
