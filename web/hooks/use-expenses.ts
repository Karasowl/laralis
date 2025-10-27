'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { useCurrentClinic } from '@/hooks/use-current-clinic'
import type {
  ExpenseFilters,
  ExpenseWithRelations,
  ExpenseStats,
  ExpenseFormData,
  LowStockAlert,
} from '@/lib/types/expenses'

type BudgetAlertSeverity = 'high' | 'medium' | 'low'

interface BudgetAlertDetails {
  planned: number
  actual: number
  variance: number
  percentage: number
}

interface BudgetAlert {
  type: string
  message: string
  severity: BudgetAlertSeverity
  details: BudgetAlertDetails
}

interface PriceChangeAlert {
  id: string
  name: string
  category: string
  price_per_portion_cents: number
  last_purchase_price_cents: number
  price_change_percentage: number
}

interface ExpenseAlerts {
  low_stock: LowStockAlert[]
  price_changes: PriceChangeAlert[]
  budget_alerts: BudgetAlert[]
  summary: {
    total_alerts: number
    by_severity: {
      high: number
      medium: number
      low: number
    }
  }
}

interface UseExpensesOptions {
  clinicId?: string
  autoLoad?: boolean
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const { clinicId: providedClinicId, autoLoad = true } = options
  const { currentClinic } = useCurrentClinic()

  const t = useTranslations('expenses')
  const effectiveClinicId = providedClinicId ?? currentClinic?.id ?? null

  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([])
  const [filters, setFiltersState] = useState<ExpenseFilters>({})
  const [stats, setStats] = useState<ExpenseStats | null>(null)
  const [alerts, setAlerts] = useState<ExpenseAlerts | null>(null)

  const [listLoading, setListLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.category) params.set('category', filters.category)
    if (filters.subcategory) params.set('subcategory', filters.subcategory)
    if (filters.vendor) params.set('vendor', filters.vendor)
    if (filters.start_date) params.set('start_date', filters.start_date)
    if (filters.end_date) params.set('end_date', filters.end_date)
    if (typeof filters.min_amount === 'number') params.set('min_amount', String(filters.min_amount))
    if (typeof filters.max_amount === 'number') params.set('max_amount', String(filters.max_amount))
    if (typeof filters.is_recurring === 'boolean') params.set('is_recurring', String(filters.is_recurring))
    if (typeof filters.auto_processed === 'boolean') params.set('auto_processed', String(filters.auto_processed))
    return params
  }, [filters])

  const fetchExpenses = useCallback(async () => {
    if (!effectiveClinicId) return
    setListLoading(true)

    try {
      const params = new URLSearchParams(queryString)
      params.set('clinic_id', effectiveClinicId)

      const response = await fetch(`/api/expenses?${params.toString()}`, {
        credentials: 'include',
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to fetch expenses')
      }

      const list = Array.isArray(payload?.data) ? (payload.data as ExpenseWithRelations[]) : []
      setExpenses(list)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
    } finally {
      setListLoading(false)
    }
  }, [effectiveClinicId, queryString])

  const fetchStats = useCallback(async () => {
    if (!effectiveClinicId) return
    setStatsLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('clinic_id', effectiveClinicId)
      if (filters.start_date) params.set('start_date', filters.start_date)
      if (filters.end_date) params.set('end_date', filters.end_date)

      const response = await fetch(`/api/expenses/stats?${params.toString()}`, {
        credentials: 'include',
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to fetch expense stats')
      }

      setStats(payload?.data ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
    } finally {
      setStatsLoading(false)
    }
  }, [effectiveClinicId, filters.start_date, filters.end_date])

  const fetchAlerts = useCallback(async () => {
    if (!effectiveClinicId) return
    setAlertsLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('clinic_id', effectiveClinicId)

      const response = await fetch(`/api/expenses/alerts?${params.toString()}`, {
        credentials: 'include',
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to fetch alerts')
      }

      setAlerts(payload?.data ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
    } finally {
      setAlertsLoading(false)
    }
  }, [effectiveClinicId])

  const refresh = useCallback(async () => {
    await Promise.all([fetchExpenses(), fetchStats(), fetchAlerts()])
  }, [fetchAlerts, fetchExpenses, fetchStats])

  useEffect(() => {
    if (!autoLoad || !effectiveClinicId) return
    void fetchExpenses()
    void fetchStats()
  }, [autoLoad, effectiveClinicId, fetchExpenses, fetchStats])

  useEffect(() => {
    if (!autoLoad || !effectiveClinicId) return
    void fetchAlerts()
  }, [autoLoad, effectiveClinicId, fetchAlerts])

  const updateFilters = useCallback((updates: Partial<ExpenseFilters>) => {
    setFiltersState(prev => {
      const next: ExpenseFilters = { ...prev, ...updates }
      const clean: ExpenseFilters = {}
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === null || value === '') continue
        ;(clean as any)[key] = value
      }
      return clean
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState({})
  }, [])

  const handleRequest = useCallback(
    async (method: 'POST' | 'PUT' | 'DELETE', endpoint: string, body?: any) => {
      console.log('[use-expenses] Making request:', { method, endpoint, body })

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })

      const payload = await response.json().catch(() => null)
      console.log('[use-expenses] Response:', { status: response.status, ok: response.ok, payload })

      if (!response.ok) {
        const errorMsg = payload?.error || payload?.message || 'Request failed'
        console.error('[use-expenses] Request failed:', errorMsg, payload)
        throw new Error(errorMsg)
      }

      return payload
    },
    []
  )

  const createExpense = useCallback(
    async (data: ExpenseFormData): Promise<boolean> => {
      if (!effectiveClinicId) {
        toast.error(t('messages.noClinic'))
        return false
      }

      setIsSubmitting(true)
      try {
        await handleRequest('POST', '/api/expenses', {
          ...data,
          clinic_id: effectiveClinicId,
        })
        await refresh()
        toast.success(t('messages.createSuccess', { entity: t('entity') }))
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toast.error(message || t('messages.createError', { entity: t('entity') }))
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [effectiveClinicId, handleRequest, refresh, t]
  )

  const updateExpense = useCallback(
    async (id: string, data: Partial<ExpenseFormData>): Promise<boolean> => {
      setIsSubmitting(true)
      try {
        await handleRequest('PUT', `/api/expenses/${id}`, data)
        await refresh()
        toast.success(t('messages.updateSuccess', { entity: t('entity') }))
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toast.error(message || t('messages.updateError', { entity: t('entity') }))
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [handleRequest, refresh, t]
  )

  const deleteExpense = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await handleRequest('DELETE', `/api/expenses/${id}`)
        await refresh()
        toast.success(t('messages.deleteSuccess', { entity: t('entity') }))
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toast.error(message || t('messages.deleteError', { entity: t('entity') }))
        return false
      }
    },
    [handleRequest, refresh, t]
  )

  const loading = listLoading || statsLoading || alertsLoading

  return {
    expenses,
    filters,
    stats,
    alerts,
    loading,
    listLoading,
    statsLoading,
    alertsLoading,
    isSubmitting,
    setFilters: updateFilters,
    resetFilters,
    refresh,
    createExpense,
    updateExpense,
    deleteExpense,
    clinicId: effectiveClinicId,
    hasData: expenses.length > 0,
    totalCount: expenses.length,
  }
}
