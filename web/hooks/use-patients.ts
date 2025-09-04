'use client'

import { useCallback } from 'react'
import { useCrudOperations } from './use-crud-operations'
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

export function usePatients(options: UsePatientsOptions = {}) {
  const { clinicId, autoLoad = true } = options
  
  // Use generic CRUD for patients
  const crud = useCrudOperations<Patient>({
    endpoint: '/api/patients',
    entityName: 'Patient',
    includeClinicId: true,
    searchParam: 'search'
  })

  // Use API hooks for related data
  const sourcesApi = useApi<PatientSource[]>('/api/patient-sources')
  const campaignsApi = useApi<Campaign[]>('/api/campaigns')
  const platformsApi = useApi<any[]>('/api/marketing/platforms')

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

  // Load related data
  const loadRelatedData = useCallback(async () => {
    console.log('[usePatients] Loading patient related data...')
    try {
      const results = await Promise.all([
        sourcesApi.get(),
        campaignsApi.get(),
        platformsApi.get()
      ])
      console.log('[usePatients] API Results:', {
        sources: results[0],
        campaigns: results[1],
        platforms: results[2]
      })
      console.log('[usePatients] platformsApi.data after get():', platformsApi.data)
      
      // Hacer una llamada directa para debug
      const directResponse = await fetch('/api/marketing/platforms', {
        credentials: 'include'
      })
      const directData = await directResponse.json()
      console.log('[usePatients] Direct fetch result:', directData)
      
    } catch (error) {
      console.error('[usePatients] Error in loadRelatedData:', error)
    }
  }, [sourcesApi, campaignsApi, platformsApi])

  // Debug log antes de retornar
  console.log('[usePatients] Current state:', {
    platformsApiData: platformsApi.data,
    platformsApiLoading: platformsApi.loading,
    sourcesApiData: sourcesApi.data,
    campaignsApiData: campaignsApi.data
  })

  return {
    // From CRUD operations
    patients: crud.items,
    loading: crud.loading || sourcesApi.loading || campaignsApi.loading,
    error: null,
    searchTerm: crud.searchTerm,
    setSearchTerm: crud.setSearchTerm,
    
    // From API hooks
    patientSources: sourcesApi.data || [],
    campaigns: campaignsApi.data || [],
    platforms: platformsApi.data || [],
    
    // Patient operations
    fetchPatients: crud.fetchItems,
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
