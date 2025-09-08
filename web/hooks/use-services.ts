'use client'

import { useCallback } from 'react'
import { useCrudOperations } from './use-crud-operations'
import { useApi } from './use-api'
import { useSupplies } from './use-supplies'

export interface Service {
  id: string
  clinic_id: string
  name: string
  description?: string
  category?: string
  duration_minutes: number
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

export function useServices(options: UseServicesOptions = {}) {
  const { clinicId, autoLoad = true } = options
  
  // Use generic CRUD operations
  const crud = useCrudOperations<Service>({
    endpoint: '/api/services',
    entityName: 'Service',
    includeClinicId: true
  })

  // Use API hook for categories
  const categoriesApi = useApi<Category[]>('/api/categories?entity_type=service')
  
  // Use API hook for service supplies
  const suppliesApi = useApi<ServiceSupply[]>('/api/services')
  
  // Get supplies from existing hook
  const { supplies } = useSupplies({ clinicId })

  // Service-specific: Fetch service supplies
  const fetchServiceSupplies = useCallback(async (serviceId: string): Promise<ServiceSupply[]> => {
    const result = await suppliesApi.get()
    if (result.success) {
      return result.data || []
    }
    return []
  }, [suppliesApi])

  // Service-specific: Update service supplies
  const updateServiceSupplies = useCallback(async (
    serviceId: string, 
    supplies: Array<{ supply_id: string; quantity: number }>
  ): Promise<boolean> => {
    const result = await suppliesApi.put(
      { supplies },
      { 
        showSuccessToast: false // Handle toast in parent
      }
    )
    return result.success
  }, [suppliesApi])

  // Service-specific: Create category
  const createCategory = useCallback(async (name: string): Promise<boolean> => {
    const result = await categoriesApi.post(
      { name, entity_type: 'service' },
      { 
        showSuccessToast: true,
        successMessage: 'Category created successfully'
      }
    )
    
    if (result.success) {
      // Refresh categories
      await categoriesApi.get()
      return true
    }
    return false
  }, [categoriesApi])

  // Enhanced create with supplies
  const createService = useCallback(async (data: any): Promise<boolean> => {
    const { supplies: serviceSupplies, ...serviceData } = data
    
    // Create service using CRUD operations
    const success = await crud.handleCreate(serviceData)
    
    if (success && serviceSupplies && serviceSupplies.length > 0) {
      // Get the newly created service (last one in the list)
      const newService = crud.items[0] // CRUD adds new items at the beginning
      if (newService) {
        await updateServiceSupplies(newService.id, serviceSupplies)
      }
    }
    
    return success
  }, [crud, updateServiceSupplies])

  // Enhanced update with supplies
  const updateService = useCallback(async (id: string, data: any): Promise<boolean> => {
    const { supplies: serviceSupplies, ...serviceData } = data
    
    // Update service using CRUD operations
    const success = await crud.handleUpdate(id, serviceData)
    
    if (success && serviceSupplies !== undefined) {
      await updateServiceSupplies(id, serviceSupplies)
    }
    
    return success
  }, [crud, updateServiceSupplies])

  return {
    // From CRUD operations
    services: crud.items,
    loading: crud.loading,
    error: null,
    
    // From API hooks
    categories: categoriesApi.data || [],
    supplies,
    
    // Service operations
    fetchServices: crud.fetchItems,
    createService,
    updateService,
    deleteService: crud.handleDelete,
    
    // Service-specific operations
    fetchServiceSupplies,
    createCategory
  }
}