'use client'

import { useApi } from '@/hooks/use-api'

export type CategoryType = 'services' | 'supplies' | 'expenses' | 'assets'

export interface CategoryRow {
  id?: string
  clinic_id?: string | null
  category_type_id?: string | null
  entity_type?: string | null
  code?: string | null
  name?: string | null
  display_name?: string | null
  is_system?: boolean
  is_active?: boolean
}

export function useCategories(type: CategoryType) {
  const categoriesApi = useApi<CategoryRow[]>(`/api/categories?type=${type}&active=true`, { autoFetch: true })

  const refresh = () => categoriesApi.get()

  const createCategory = async (name: string) => {
    const code = String(name)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    const res = await categoriesApi.post(
      { name, code, is_active: true },
      { showSuccessToast: true, successMessage: 'Category created successfully', updateState: false }
    )
    if (res.success) await categoriesApi.get()
    return !!res.success
  }

  const updateCategory = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/categories/${id}?type=${type}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name })
      })
      if (!res.ok) return false
      await categoriesApi.get()
      return true
    } catch { return false }
  }

  const deleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}?type=${type}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) return false
      await categoriesApi.get()
      return true
    } catch { return false }
  }

  return {
    categories: categoriesApi.data || [],
    loading: categoriesApi.loading,
    error: categoriesApi.error,
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
  }
}

