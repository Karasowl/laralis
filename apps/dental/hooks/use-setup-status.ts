'use client'

import { useEffect, useState, useCallback } from 'react'

type SetupStatus = {
  clinicId: string
  hasTime: boolean
  hasFixedCosts: boolean
  hasAssets: boolean
  suppliesCount: number
  servicesWithRecipeCount: number
}

export function useSetupStatus() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SetupStatus | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/setup/status', { credentials: 'include' })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setStatus(json?.data || null)
    } catch (e: any) {
      setError(e?.message || 'Error')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { loading, error, status, refetch }
}
