'use client'

import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { Clinic } from '@/lib/types'

export function useCurrentClinic() {
  const [clinicId, setClinicId] = useState<string | null>(null)
  
  // Get clinic ID from cookie or use default
  useEffect(() => {
    let id = getCookieValue('clinicId')
    console.log('[useCurrentClinic] Cookie clinicId:', id)
    
    // If no clinicId cookie, try to get from user metadata
    if (!id) {
      // Hardcode the default clinic for now (from your user metadata)
      id = '0fd9b635-9297-401b-b092-6452621b31e1'
      console.log('[useCurrentClinic] Using hardcoded default clinic:', id)
      // Set the cookie for future use
      document.cookie = `clinicId=${id}; path=/; max-age=31536000`
    }
    
    setClinicId(id)
  }, [])
  
  // Use API hook to fetch clinics
  const { data, loading, error } = useApi<{ data: Clinic[] }>(
    '/api/clinics',
    { autoFetch: true }
  )
  
  // Find current clinic from the list
  const currentClinic = useMemo(() => {
    console.log('[useCurrentClinic] Finding clinic. Data:', data, 'ClinicId:', clinicId)
    
    // TEMPORAL: Forzar la clínica mientras arreglamos el API
    if (clinicId === '0fd9b635-9297-401b-b092-6452621b31e1') {
      console.log('[useCurrentClinic] Using hardcoded clinic object')
      return {
        id: '0fd9b635-9297-401b-b092-6452621b31e1',
        name: 'Clínica Principal',
        workspace_id: '82c2ea8b-5661-45b6-a66f-2fa03264d9f4'
      } as Clinic
    }
    
    if (!data?.data || !clinicId) {
      console.log('[useCurrentClinic] No data or clinicId, returning null')
      return null
    }
    const found = data.data.find((c: Clinic) => c.id === clinicId) || null
    console.log('[useCurrentClinic] Found clinic:', found)
    return found
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