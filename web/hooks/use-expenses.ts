'use client'

import { useMemo, useCallback, useState } from 'react'
import { useCrudOperations } from '@/hooks/use-crud-operations'
import { useApi } from '@/hooks/use-api'
import { ExpenseWithRelations, ExpenseFilters, ExpenseFormData } from '@/lib/types/expenses'

interface UseExpensesOptions {
  clinicId?: string
  filters?: ExpenseFilters
  limit?: number
  autoLoad?: boolean
}

interface ExpenseStats {
  totalAmount: number
  totalCount: number
  byCategory: Record<string, number>
  monthlyAverage: number
  topVendors: Array<{ vendor: string; amount: number }>
}

export function useExpenses(options: UseExpensesOptions = {}) {
  const { clinicId, filters, limit, autoLoad = true } = options
  const [localFilters, setLocalFilters] = useState<ExpenseFilters>(filters || {})

  // Build query string with filters (excluding clinic_id; it will be appended by useCrudOperations)
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (localFilters.category) params.append('category', localFilters.category)
    if (localFilters.vendor) params.append('vendor', localFilters.vendor)
    if (localFilters.start_date) params.append('start_date', localFilters.start_date)
    if (localFilters.end_date) params.append('end_date', localFilters.end_date)
    if (limit) params.append('limit', limit.toString())
    return params.toString()
  }, [localFilters, limit])

  // Use generic CRUD with dynamic endpoint and automatic clinic id
  const crud = useCrudOperations<ExpenseWithRelations>({
    endpoint: `/api/expenses${queryString ? `?${queryString}` : ''}`,
    entityName: 'Expense',
    includeClinicId: true
  })

  // Use API hooks for related data
  const categoriesApi = useApi<{ data: any[] }>(
    '/api/categories?type=expenses&active=true',
    { autoFetch: true }
  )
  const vendorsApi = useApi<{ data: any[] }>('/api/vendors')
  const paymentMethodsApi = useApi<{ data: any[] }>('/api/payment-methods')

  // Calculate stats using memoization
  const stats = useMemo((): ExpenseStats => {
    const expenses = crud.items || []
    
    // Total amount and count
    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0)
    const totalCount = expenses.length
    
    // By category
    const byCategory: Record<string, number> = {}
    expenses.forEach(e => {
      if (e.category) {
        byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount_cents || 0)
      }
    })
    
    // Monthly average (last 12 months)
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)
    const recentExpenses = expenses.filter(e => 
      new Date(e.date) >= twelveMonthsAgo
    )
    const monthlyAverage = recentExpenses.length > 0 
      ? recentExpenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0) / 12
      : 0
    
    // Top vendors
    const vendorTotals = new Map<string, number>()
    expenses.forEach(e => {
      if (e.vendor) {
        const current = vendorTotals.get(e.vendor) || 0
        vendorTotals.set(e.vendor, current + (e.amount_cents || 0))
      }
    })
    
    const topVendors = Array.from(vendorTotals.entries())
      .map(([vendor, amount]) => ({ vendor, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
    
    return {
      totalAmount,
      totalCount,
      byCategory,
      monthlyAverage,
      topVendors
    }
  }, [crud.items])

  // Update filters
  const updateFilters = useCallback((newFilters: ExpenseFilters) => {
    setLocalFilters(newFilters)
  }, [])

  // Enhanced create with supply items
  const createExpense = useCallback(async (data: ExpenseFormData): Promise<boolean> => {
    return await crud.handleCreate(data)
  }, [crud])

  // Batch operations
  const deleteMultiple = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      const promises = ids.map(id => crud.handleDelete(id))
      const results = await Promise.all(promises)
      return results.every(r => r)
    } catch (error) {
      return false
    }
  }, [crud])

  return {
    // From CRUD operations
    expenses: crud.items,
    loading: crud.loading,
    error: null,
    
    // Related data
    categories: categoriesApi.data?.data || [],
    vendors: vendorsApi.data?.data || [],
    paymentMethods: paymentMethodsApi.data?.data || [],
    
    // Calculated data
    stats,
    
    // Filters
    filters: localFilters,
    updateFilters,
    
    // Operations
    fetchExpenses: crud.fetchItems,
    createExpense,
    updateExpense: crud.handleUpdate,
    deleteExpense: crud.handleDelete,
    deleteMultiple,
    
    // UI State
    isSubmitting: crud.isSubmitting,
    searchTerm: crud.searchTerm,
    setSearchTerm: crud.setSearchTerm
  }
}
