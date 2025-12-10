'use client'

import { useCallback } from 'react'
import { useSwrCrud } from './use-swr-crud'
import { useApi } from './use-api'
import { Patient, PatientSource } from '@/lib/types'

export interface Campaign {
  id: string
  name: string
  source_id: string
  description?: string
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
}

interface UsePatientsOptions {
  clinicId?: string
  autoLoad?: boolean
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === 'object' && Array.isArray((value as any).data)) {
    return ((value as any).data) as T[];
  }
  return [];
}

export function usePatients(options: UsePatientsOptions = {}) {
  const { clinicId, autoLoad = true } = options
  
  // Use SWR-based CRUD for patients with caching
  const crud = useSwrCrud<Patient>({
    endpoint: '/api/patients',
    entityName: 'Patient',
    includeClinicId: true,
    searchParam: 'search',
    revalidateOnFocus: true, // Refresh when user returns to tab
  })

  // Use API hooks for related data (respect autoLoad option)
  const sourcesApi = useApi<PatientSource[]>('/api/patient-sources', { autoFetch: autoLoad })
  // Use marketing endpoint which handles clinic context and does not require user session
  const campaignsApi = useApi<Campaign[]>('/api/marketing/campaigns', { autoFetch: autoLoad })
  const platformsApi = useApi<any[]>('/api/marketing/platforms', { autoFetch: autoLoad })

  // Patient-specific: Create patient source
  const createPatientSource = useCallback(async (name: string): Promise<boolean> => {
    const result = await sourcesApi.post(
      { name },
      { 
        showSuccessToast: true,
        successMessage: 'Patient source created successfully'
      }
    )
    
    if (result.success) {
      // Refresh sources
      await sourcesApi.get()
      return true
    }
    return false
  }, [sourcesApi])

  // Patient-specific: Create campaign
  const createCampaign = useCallback(async (data: Partial<Campaign>): Promise<boolean> => {
    const result = await campaignsApi.post(
      data,
      { 
        showSuccessToast: true,
        successMessage: 'Campaign created successfully'
      }
    )
    
    if (result.success) {
      // Refresh campaigns
      await campaignsApi.get()
      return true
    }
    return false
  }, [campaignsApi])

  // Load related data (stable deps based on methods only)
  const loadRelatedData = useCallback(async () => {
    try {
      const results = await Promise.all([
        sourcesApi.get(),
        campaignsApi.get(),
        platformsApi.get()
      ])
      // optional: inspect results if needed
    } catch (error) {
      // swallow toasts are handled in useApi
    }
  }, [sourcesApi.get, campaignsApi.get, platformsApi.get])

  // no noisy logs here; state is returned below

  return {
    // From SWR CRUD operations (with caching)
    patients: crud.items,
    loading: crud.loading || sourcesApi.loading || campaignsApi.loading || platformsApi.loading,
    isValidating: crud.isValidating, // NEW: Shows background revalidation
    error: null,
    searchTerm: crud.searchTerm,
    setSearchTerm: crud.setSearchTerm,

    // From API hooks
    patientSources: ensureArray<PatientSource>(sourcesApi.data),
    campaigns: ensureArray<Campaign>(campaignsApi.data),
    platforms: ensureArray<any>(platformsApi.data),

    // Patient operations
    fetchPatients: crud.refresh, // SWR uses refresh instead of fetchItems
    createPatient: crud.handleCreate,
    updatePatient: crud.handleUpdate,
    deletePatient: crud.handleDelete,
    searchPatients: crud.setSearchTerm, // Map searchPatients to setSearchTerm

    // Patient-specific operations
    createPatientSource,
    createCampaign,
    loadRelatedData
  }
}
