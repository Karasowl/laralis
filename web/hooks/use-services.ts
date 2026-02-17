'use client'

import { useCallback } from 'react'
import { useSwrCrud } from './use-swr-crud'
import { useApi } from './use-api'
import { useSupplies } from './use-supplies'

export interface Service {
  id: string
  clinic_id: string
  name: string
  description?: string
  category?: string
  est_minutes: number
  base_price_cents: number
  created_at: string
  updated_at: string
}

export interface ServiceSupply {
  service_id: string
  supply_id: string
  quantity: number
}

export interface Category {
  id: string
  name: string
  entity_type: string
}

interface UseServicesOptions {
  clinicId?: string
  autoLoad?: boolean
}

function extractList<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && Array.isArray((value as any).data)) return (value as any).data as T[];
  return [];
}

export function useServices(options: UseServicesOptions = {}) {
  const { clinicId, autoLoad = true } = options
  
  // Use SWR-based CRUD operations with caching
  const crud = useSwrCrud<Service>({
    endpoint: '/api/services',
    entityName: 'Service',
    includeClinicId: true,
    revalidateOnFocus: true,
  })

  // Use API hook for categories (new categories system via type=services)
  const categoriesApi = useApi<Category[]>('/api/categories?type=services&active=true', { autoFetch: true })
  
  // Service supplies are handled via dynamic endpoints per service id
  
  // Get supplies from existing hook
  const { supplies } = useSupplies({ clinicId })

  // Service-specific: Fetch service supplies
  const fetchServiceSupplies = useCallback(async (serviceId: string): Promise<ServiceSupply[]> => {
    try {
      const res = await fetch(`/api/services/${serviceId}/supplies`, { credentials: 'include' })
      if (!res.ok) return []
      const js = await res.json()
      const list = (Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : []) as any[]
      // Map API "qty" to UI "quantity"
      return list.map((item) => ({ supply_id: item.supply_id, quantity: item.qty })) as any
    } catch {
      return []
    }
  }, [])

  // Service-specific: Update service supplies
  // Supplies updates are handled by the service endpoints themselves

  // Service-specific: Create category
  const createCategory = useCallback(async (name: string): Promise<boolean> => {
    // Simple slug from name for code
    const code = String(name)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const result = await categoriesApi.post(
      { name, code, is_active: true },
      { 
        showSuccessToast: true,
        successMessage: 'Category created successfully',
        updateState: false // avoid replacing the list with a single object
      }
    )
    
    if (result.success) {
      await categoriesApi.get()
      return true
    }
    return false
  }, [categoriesApi])

  // Service-specific: Update category name
  const updateCategory = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/categories/${id}?type=services`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      if (!res.ok) return false
      await categoriesApi.get()
      return true
    } catch {
      return false
    }
  }, [categoriesApi])

  // Service-specific: Delete category (soft delete or remap)
  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/categories/${id}?type=services`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) return false
      await categoriesApi.get()
      return true
    } catch {
      return false
    }
  }, [categoriesApi])

  // Enhanced create with supplies
  const createService = useCallback(async (data: any): Promise<boolean> => {
    const { supplies: serviceSupplies, ...serviceData } = data

    // Ignore default/empty target price (0) to avoid forcing zero-priced services.
    const normalizedTargetPrice = Number(serviceData.target_price)
    const hasTargetPrice = Number.isFinite(normalizedTargetPrice) && normalizedTargetPrice > 0
    const priceField = hasTargetPrice
      ? { target_price: normalizedTargetPrice }
      : { price_cents: serviceData.price_cents ?? serviceData.base_price_cents ?? 0 }

    const payload = {
      ...serviceData,
      est_minutes: serviceData.est_minutes ?? serviceData.duration_minutes ?? 0,
      ...priceField
    }

    if (!payload.name || !payload.est_minutes) {
      console.warn('[useServices] missing name or duration when creating service', payload)
      return false
    }

    // Include supplies in create payload so API can persist them
    const sanitized = Array.isArray(serviceSupplies)
      ? serviceSupplies.filter((s) => s.supply_id && (s.quantity ?? 0) > 0)
      : []
    // Best-effort clinic id resolution to avoid races when context is not ready
    let clinicIdFromHints: string | undefined
    try {
      if (typeof document !== 'undefined') {
        const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/)
        clinicIdFromHints = m ? decodeURIComponent(m[1]) : undefined
      }
      if (!clinicIdFromHints && typeof localStorage !== 'undefined') {
        clinicIdFromHints = localStorage.getItem('selectedClinicId') || undefined
      }
    } catch {}

    const success = await crud.handleCreate({
      ...payload,
      ...(clinicIdFromHints ? { clinic_id: clinicIdFromHints } : {}),
      ...(sanitized.length > 0
        ? { supplies: sanitized.map((s) => ({ supply_id: s.supply_id, qty: s.quantity })) }
        : {})
    })

    return success
  }, [crud])

  // Enhanced update with supplies
  const updateService = useCallback(async (id: string, data: any): Promise<boolean> => {
    const { supplies: serviceSupplies, ...serviceData } = data

    // Ignore default/empty target price (0) to avoid forcing zero-priced services.
    const normalizedTargetPrice = Number(serviceData.target_price)
    const hasTargetPrice = Number.isFinite(normalizedTargetPrice) && normalizedTargetPrice > 0
    const priceField = hasTargetPrice
      ? { target_price: normalizedTargetPrice }
      : { price_cents: serviceData.price_cents ?? serviceData.base_price_cents ?? 0 }

    const payload = {
      ...serviceData,
      est_minutes: serviceData.est_minutes ?? serviceData.duration_minutes ?? 0,
      ...priceField
    }

    const sanitized = serviceSupplies === undefined
      ? undefined
      : serviceSupplies.filter((s: any) => s.supply_id && (s.quantity ?? 0) > 0)

    const success = await crud.handleUpdate(id, {
      ...payload,
      ...(sanitized !== undefined
        ? { supplies: sanitized.map((s: any) => ({ supply_id: s.supply_id, qty: s.quantity })) }
        : {})
    })

    return success
  }, [crud])

  return {
    // From SWR CRUD operations (with caching)
    services: crud.items,
    loading: crud.loading,
    isValidating: crud.isValidating, // NEW: Shows background revalidation
    error: null,

    // From API hooks
    categories: extractList<Category>(categoriesApi.data),
    supplies,

    // Service operations
    fetchServices: crud.refresh, // SWR uses refresh instead of fetchItems
    createService,
    updateService,
    deleteService: crud.handleDelete,

    // Service-specific operations
    fetchServiceSupplies,
    createCategory,
    updateCategory,
    deleteCategory
  }
}
