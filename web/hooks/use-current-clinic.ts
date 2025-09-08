'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { Clinic } from '@/lib/types'

export function useCurrentClinic() {
  const [clinicId, setClinicId] = useState<string | null>(null)

  // Read initial clinic from cookie (if set by navigation/UI)
  useEffect(() => {
    const id = getCookie('clinicId')
    if (id) setClinicId(id)
  }, [])

  // Fetch clinics for the authenticated user
  const { data, loading, error } = useApi<{ data: Clinic[] }>(
    '/api/clinics',
    { autoFetch: true }
  )

  // Choose clinic consistently: cookie > first available
  useEffect(() => {
    const clinics = data?.data || []
    if (clinics.length === 0) return

    // Prefer cookie if valid; otherwise pick first and persist
    const cookieId = clinicId
    const exists = cookieId && clinics.some(c => c.id === cookieId)
    const selected = exists ? cookieId! : clinics[0].id
    if (!exists || clinicId !== selected) {
      setClinicId(selected)
      setCookie('clinicId', selected)
    }
  }, [data?.data, clinicId])

  const currentClinic = useMemo(() => {
    const clinics = data?.data || []
    if (clinics.length === 0) return null
    if (!clinicId) return clinics[0]
    return clinics.find(c => c.id === clinicId) || clinics[0]
  }, [data?.data, clinicId])

  return { currentClinic, loading, error }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; max-age=31536000`
}
