'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { useApi } from '@/hooks/use-api'
import { useWorkspace } from '@/contexts/workspace-context'
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
  filters?: Partial<ExpenseFilters>
  limit?: number
  autoLoad?: boolean
}

function getClientClinicId(): string | null {
  if (typeof document === 'undefined') return null

  try {
    const cookieMatch = document.cookie.match(/(?:^|; )clinicId=([^;]+)/)
    if (cookieMatch?.[1]) {
      return decodeURIComponent(cookieMatch[1])
    }

    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('selectedClinicId')
      if (stored) return stored
    }
  } catch {
    // Ignore access errors for cookie/localStorage and return null fallback.
  }

  return null
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const { clinicId: providedClinicId, filters: externalFilters = {}, limit, autoLoad = true } = options
  const { currentClinic: workspaceClinic } = useWorkspace()
  const { currentClinic } = useCurrentClinic()
  const t = useTranslations('expenses')

  const effectiveClinicId = providedClinicId ?? workspaceClinic?.id ?? currentClinic?.id ?? getClientClinicId() ?? null
  const [filtersState, setFiltersState] = useState<ExpenseFilters>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filters = useMemo(() => {
    const merged: ExpenseFilters = { ...filtersState, ...externalFilters }
    const clean: ExpenseFilters = {}
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === null || value === '') continue
      ;(clean as Record<string, unknown>)[key] = value
    }
    return clean
  }, [externalFilters, filtersState])

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

  const listEndpoint = useMemo(() => {
    if (!effectiveClinicId) return null
    const params = new URLSearchParams(queryString)
    params.set('clinic_id', effectiveClinicId)
    return `/api/expenses?${params.toString()}`
  }, [effectiveClinicId, queryString])

  const statsEndpoint = useMemo(() => {
    if (!effectiveClinicId) return null
    const params = new URLSearchParams()
    params.set('clinic_id', effectiveClinicId)
    if (filters.start_date) params.set('start_date', filters.start_date)
    if (filters.end_date) params.set('end_date', filters.end_date)
    return `/api/expenses/stats?${params.toString()}`
  }, [effectiveClinicId, filters.end_date, filters.start_date])

  const alertsEndpoint = useMemo(() => {
    if (!effectiveClinicId) return null
    const params = new URLSearchParams()
    params.set('clinic_id', effectiveClinicId)
    return `/api/expenses/alerts?${params.toString()}`
  }, [effectiveClinicId])

  const listApi = useApi<{ data: ExpenseWithRelations[] }>(listEndpoint, {
    autoFetch: autoLoad && !!listEndpoint,
  })
  const statsApi = useApi<{ data: ExpenseStats }>(statsEndpoint, {
    autoFetch: autoLoad && !!statsEndpoint,
  })
  const alertsApi = useApi<{ data: ExpenseAlerts }>(alertsEndpoint, {
    autoFetch: autoLoad && !!alertsEndpoint,
  })

  const rawExpenses = useMemo(
    () => (Array.isArray(listApi.data?.data) ? listApi.data.data : []),
    [listApi.data]
  )

  const categories = useMemo(() => {
    const categoryNames = Array.from(new Set(rawExpenses.map((item) => item.category).filter(Boolean)))
    return categoryNames.map((name) => ({
      id: `category-${String(name).toLowerCase().replace(/\s+/g, '-')}`,
      name,
      display_name: name,
    }))
  }, [rawExpenses])

  const expenses = useMemo(() => {
    const base = searchTerm.trim()
      ? rawExpenses.filter((item) => {
          const term = searchTerm.toLowerCase().trim()
          return (
            item.description?.toLowerCase().includes(term) ||
            item.vendor?.toLowerCase().includes(term) ||
            item.category?.toLowerCase().includes(term) ||
            item.subcategory?.toLowerCase().includes(term)
          )
        })
      : rawExpenses

    if (typeof limit === 'number' && limit > 0) {
      return base.slice(0, limit)
    }

    return base
  }, [limit, rawExpenses, searchTerm])
  const stats = statsApi.data?.data ?? null
  const alerts = alertsApi.data?.data ?? null
  const error = listApi.error ?? statsApi.error ?? alertsApi.error

  const refresh = useCallback(async () => {
    const calls: Array<Promise<unknown>> = []
    if (listEndpoint) calls.push(listApi.get())
    if (statsEndpoint) calls.push(statsApi.get())
    if (alertsEndpoint) calls.push(alertsApi.get())
    await Promise.all(calls)
  }, [alertsApi, alertsEndpoint, listApi, listEndpoint, statsApi, statsEndpoint])

  const updateFilters = useCallback((updates: Partial<ExpenseFilters>) => {
    setFiltersState((prev) => {
      const next: ExpenseFilters = { ...prev, ...updates }
      const clean: ExpenseFilters = {}
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === null || value === '') continue
        ;(clean as Record<string, unknown>)[key] = value
      }
      return clean
    })
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState({})
  }, [])

  const handleRequest = useCallback(async (method: 'POST' | 'PUT' | 'DELETE', endpoint: string, body?: unknown) => {
    const response = await fetch(endpoint, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const errorMsg = payload?.error || payload?.message || 'Request failed'
      throw new Error(errorMsg)
    }

    return payload
  }, [])

  const createExpense = useCallback(
    async (data: ExpenseFormData): Promise<boolean> => {
      const activeClinicId = effectiveClinicId ?? getClientClinicId()
      if (!activeClinicId) {
        toast.error(t('messages.noClinic'))
        return false
      }

      setIsSubmitting(true)
      try {
        await handleRequest('POST', `/api/expenses?clinicId=${encodeURIComponent(activeClinicId)}`, {
          ...data,
          clinic_id: activeClinicId,
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
      const activeClinicId = effectiveClinicId ?? getClientClinicId()
      if (!activeClinicId) {
        toast.error(t('messages.noClinic'))
        return false
      }

      setIsSubmitting(true)
      try {
        await handleRequest('PUT', `/api/expenses/${id}?clinicId=${encodeURIComponent(activeClinicId)}`, data)
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
    [effectiveClinicId, handleRequest, refresh, t]
  )

  const deleteExpense = useCallback(
    async (id: string): Promise<boolean> => {
      const activeClinicId = effectiveClinicId ?? getClientClinicId()
      if (!activeClinicId) {
        toast.error(t('messages.noClinic'))
        return false
      }

      try {
        await handleRequest('DELETE', `/api/expenses/${id}?clinicId=${encodeURIComponent(activeClinicId)}`)
        await refresh()
        toast.success(t('messages.deleteSuccess', { entity: t('entity') }))
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toast.error(message || t('messages.deleteError', { entity: t('entity') }))
        return false
      }
    },
    [effectiveClinicId, handleRequest, refresh, t]
  )

  const loading = listApi.loading || statsApi.loading || alertsApi.loading

  return {
    expenses,
    filters,
    error,
    stats,
    alerts,
    categories,
    searchTerm,
    setSearchTerm,
    loading,
    listLoading: listApi.loading,
    statsLoading: statsApi.loading,
    alertsLoading: alertsApi.loading,
    isSubmitting,
    updateFilters,
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
