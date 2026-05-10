'use client'

import { useCallback } from 'react'
import { useSwrCrud } from './use-swr-crud'
import type { Prescription, PrescriptionItem } from '@/lib/types'

export interface CreatePrescriptionData {
  patient_id: string
  treatment_id?: string | null
  prescription_date: string
  prescriber_name: string
  prescriber_license?: string
  prescriber_specialty?: string
  diagnosis?: string
  valid_until?: string
  notes?: string
  pharmacy_notes?: string
  items: Omit<PrescriptionItem, 'id' | 'prescription_id' | 'created_at'>[]
}

export interface UpdatePrescriptionData {
  prescriber_name?: string
  prescriber_license?: string
  prescriber_specialty?: string
  diagnosis?: string
  status?: 'active' | 'cancelled' | 'expired' | 'dispensed'
  valid_until?: string
  notes?: string
  pharmacy_notes?: string
  items?: Omit<PrescriptionItem, 'id' | 'prescription_id' | 'created_at'>[]
}

interface UsePrescriptionsOptions {
  patientId?: string
  treatmentId?: string
  status?: string
  startDate?: string
  endDate?: string
}

export function usePrescriptions(options: UsePrescriptionsOptions = {}) {
  const { patientId, treatmentId, status, startDate, endDate } = options

  // Build query params
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams()
    if (patientId) params.set('patientId', patientId)
    if (treatmentId) params.set('treatmentId', treatmentId)
    if (status) params.set('status', status)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    return params.toString()
  }, [patientId, treatmentId, status, startDate, endDate])

  const queryString = buildQueryParams()
  const endpoint = `/api/prescriptions${queryString ? `?${queryString}` : ''}`

  const crud = useSwrCrud<Prescription>({
    endpoint: '/api/prescriptions',
    entityName: 'Prescription',
    includeClinicId: true,
    revalidateOnFocus: false,
  })

  // Fetch with filters
  const fetchPrescriptions = useCallback(async () => {
    const response = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      throw new Error('Failed to fetch prescriptions')
    }
    const json = await response.json()
    return json.data as Prescription[]
  }, [endpoint])

  // Create prescription
  const createPrescription = useCallback(
    async (data: CreatePrescriptionData) => {
      return crud.handleCreate(data)
    },
    [crud]
  )

  // Update prescription
  const updatePrescription = useCallback(
    async (id: string, data: UpdatePrescriptionData) => {
      return crud.handleUpdate(id, data)
    },
    [crud]
  )

  // Cancel prescription (soft delete)
  const cancelPrescription = useCallback(
    async (id: string) => {
      return crud.handleUpdate(id, { status: 'cancelled' })
    },
    [crud]
  )

  // Download PDF
  const downloadPDF = useCallback(async (prescriptionId: string) => {
    const response = await fetch(`/api/prescriptions/${prescriptionId}/pdf`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Failed to generate PDF')
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'receta.pdf'
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/)
      if (match) {
        filename = match[1]
      }
    }

    // Download file
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, [])

  return {
    prescriptions: crud.items,
    loading: crud.loading,
    fetchPrescriptions,
    createPrescription,
    updatePrescription,
    cancelPrescription,
    downloadPDF,
    refresh: crud.refresh,
  }
}
