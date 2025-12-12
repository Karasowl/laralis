'use client'

import { useCallback, useMemo } from 'react'
import { useSwrCrud } from './use-swr-crud'
import type { Medication } from '@/lib/types'

export interface CreateMedicationData {
  name: string
  generic_name?: string
  brand_name?: string
  category?: string
  controlled_substance?: boolean
  requires_prescription?: boolean
  dosage_form?: string
  strength?: string
  unit?: string
  default_dosage?: string
  default_frequency?: string
  default_duration?: string
  default_instructions?: string
  common_uses?: string[]
  contraindications?: string
  side_effects?: string
  interactions?: string
  is_active?: boolean
}

interface UseMedicationsOptions {
  category?: string
  search?: string
  activeOnly?: boolean
}

export function useMedications(options: UseMedicationsOptions = {}) {
  const { category, search, activeOnly = true } = options

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (search) params.set('search', search)
    if (!activeOnly) params.set('active', 'false')
    return params.toString()
  }, [category, search, activeOnly])

  const crud = useSwrCrud<Medication>({
    endpoint: `/api/medications${queryParams ? `?${queryParams}` : ''}`,
    entityName: 'Medication',
    includeClinicId: true,
    revalidateOnFocus: false,
  })

  // Create medication
  const createMedication = useCallback(
    async (data: CreateMedicationData) => {
      return crud.handleCreate(data)
    },
    [crud]
  )

  // Get unique categories from medications
  const categories = useMemo(() => {
    const cats = new Set<string>()
    crud.items?.forEach((med) => {
      if (med.category) {
        cats.add(med.category)
      }
    })
    return Array.from(cats).sort()
  }, [crud.items])

  // Filter medications by search term (client-side for quick filtering)
  const filterMedications = useCallback(
    (searchTerm: string) => {
      if (!searchTerm || !crud.items) return crud.items
      const term = searchTerm.toLowerCase()
      return crud.items.filter(
        (med) =>
          med.name.toLowerCase().includes(term) ||
          med.generic_name?.toLowerCase().includes(term) ||
          med.brand_name?.toLowerCase().includes(term)
      )
    },
    [crud.items]
  )

  return {
    medications: crud.items,
    loading: crud.loading,
    error: crud.error,
    categories,
    createMedication,
    filterMedications,
    refresh: crud.refresh,
  }
}
