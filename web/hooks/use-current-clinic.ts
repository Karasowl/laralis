'use client'

import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { Clinic } from '@/lib/types'

export function useCurrentClinic() {
  const [clinicId, setClinicId] = useState<string | null>(null)
  
  // Get clinic ID from cookie on mount
  useEffect(() => {
    const id = getCookieValue('clinicId')
    setClinicId(id)
  }, [])
  
  // Use API hook to fetch clinics
  const { data, loading, error } = useApi<{ data: Clinic[] }>(
    '/api/clinics',
    { autoFetch: true }
  )
  
  // Find current clinic from the list
  const currentClinic = useMemo(() => {
    if (!data?.data || !clinicId) return null
    return data.data.find((c: Clinic) => c.id === clinicId) || null
  }, [data, clinicId])
  
  return { 
    currentClinic, 
    loading,
    error 
  }
}

// Helper function to get cookie value
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null
  }
  return null
}