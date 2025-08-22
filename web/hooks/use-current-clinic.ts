'use client'

import { useState, useEffect } from 'react'
import { Clinic } from '@/lib/types'

export function useCurrentClinic() {
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCurrentClinic = async () => {
      try {
        // Get clinic ID from cookie
        const clinicId = getCookieValue('clinicId')
        if (!clinicId) {
          setLoading(false)
          return
        }

        // Fetch clinic details
        const response = await fetch('/api/clinics')
        const result = await response.json()
        
        if (result.data) {
          const clinic = result.data.find((c: Clinic) => c.id === clinicId)
          setCurrentClinic(clinic || null)
        }
      } catch (error) {
        console.error('Failed to fetch current clinic:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentClinic()
  }, [])

  const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') return null
    
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null
    }
    return null
  }

  return { currentClinic, loading }
}