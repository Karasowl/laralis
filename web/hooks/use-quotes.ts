'use client'

import { useCrudOperations } from './use-crud-operations'
import { useApi } from './use-api'
import type { Quote, QuoteItem, Patient, Service } from '@/lib/types'

export interface QuoteWithRelations extends Quote {
  patient: Patient
  items: (QuoteItem & { service?: Service })[]
}

export interface CreateQuoteData {
  patient_id: string
  quote_date: string
  validity_days?: number
  discount_type?: 'none' | 'percentage' | 'fixed'
  discount_value?: number
  tax_rate?: number
  notes?: string
  patient_notes?: string
  terms_conditions?: string
  items: {
    service_id?: string | null
    service_name: string
    service_description?: string
    quantity: number
    unit_price_cents: number
    discount_type?: 'none' | 'percentage' | 'fixed'
    discount_value?: number
    tooth_number?: string
    notes?: string
    sort_order?: number
  }[]
}

export interface UpdateQuoteData {
  validity_days?: number
  status?: Quote['status']
  discount_type?: 'none' | 'percentage' | 'fixed'
  discount_value?: number
  tax_rate?: number
  notes?: string
  patient_notes?: string
  terms_conditions?: string
  response_notes?: string
  items?: CreateQuoteData['items']
}

interface UseQuotesOptions {
  patientId?: string
  status?: Quote['status']
  startDate?: string
  endDate?: string
}

export function useQuotes(options: UseQuotesOptions = {}) {
  const { patientId, status, startDate, endDate } = options

  // Build query params
  const params = new URLSearchParams()
  if (patientId) params.set('patientId', patientId)
  if (status) params.set('status', status)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  const queryString = params.toString()
  const endpoint = `/api/quotes${queryString ? `?${queryString}` : ''}`

  const crud = useCrudOperations<QuoteWithRelations, CreateQuoteData, UpdateQuoteData>({
    endpoint: '/api/quotes',
    entityName: 'Quote',
  })

  // Override data with filtered endpoint
  const { data, loading, error, refetch } = useApi<QuoteWithRelations[]>(endpoint)

  return {
    ...crud,
    data: data || [],
    loading,
    error,
    refetch,
  }
}

export function useQuote(id: string | null) {
  const { data, loading, error, refetch } = useApi<QuoteWithRelations>(
    id ? `/api/quotes/${id}` : null
  )

  const crud = useCrudOperations<QuoteWithRelations, CreateQuoteData, UpdateQuoteData>({
    endpoint: '/api/quotes',
    entityName: 'Quote',
  })

  const downloadPdf = async () => {
    if (!id) return

    try {
      const response = await fetch(`/api/quotes/${id}/pdf`)
      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presupuesto-${data?.quote_number || id}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      throw err
    }
  }

  const updateStatus = async (newStatus: Quote['status'], responseNotes?: string) => {
    if (!id) return

    return crud.update(id, {
      status: newStatus,
      response_notes: responseNotes,
    })
  }

  const sendQuote = async (via: 'email' | 'whatsapp' | 'print') => {
    if (!id) return

    // First update status to sent
    await crud.update(id, {
      status: 'sent',
    })

    // Then update sent_via (this would be handled by the PUT endpoint)
    // For now, just download the PDF if via is print
    if (via === 'print') {
      await downloadPdf()
    }

    return refetch()
  }

  return {
    data,
    loading,
    error,
    refetch,
    update: crud.update,
    remove: crud.remove,
    downloadPdf,
    updateStatus,
    sendQuote,
  }
}
