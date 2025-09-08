'use client'

import { useCrudOperations } from './use-crud-operations'

export interface Supply {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
  cost_per_unit_cents: number
  min_stock: number
  max_stock: number
  clinic_id: string
  created_at: string
  updated_at: string
}

interface UseSuppliesOptions {
  clinicId?: string
  autoLoad?: boolean
}

export function useSupplies(options: UseSuppliesOptions = {}) {
  const { clinicId, autoLoad = true } = options
  
  // Use generic CRUD operations - that's all we need!
  const crud = useCrudOperations<Supply>({
    endpoint: '/api/supplies',
    entityName: 'Supply',
    includeClinicId: true
  })

  // No domain-specific logic needed for supplies
  // Just expose the CRUD operations with proper naming

  return {
    // Data
    supplies: crud.items,
    loading: crud.loading,
    error: null,
    
    // Operations with domain-specific names
    fetchSupplies: crud.fetchItems,
    createSupply: crud.handleCreate,
    updateSupply: crud.handleUpdate,
    deleteSupply: crud.handleDelete,
    
    // UI State (if needed by components)
    isSubmitting: crud.isSubmitting,
    editingSupply: crud.editingItem,
    isDialogOpen: crud.isDialogOpen,
    openDialog: crud.openDialog,
    closeDialog: crud.closeDialog
  }
}