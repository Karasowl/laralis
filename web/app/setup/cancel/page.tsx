'use client'

import { useEffect } from 'react'

export default function CancelSetupPage() {
  useEffect(() => {
    try {
      // Remove all onboarding progress keys (legacy + namespaced)
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        if (k === 'onboarding_progress' || k.startsWith('onboarding_progress:')) toRemove.push(k)
      }
      toRemove.forEach(k => localStorage.removeItem(k))

      // Clear selected context so onboarding starts clean
      localStorage.removeItem('selectedWorkspaceId')
      localStorage.removeItem('selectedClinicId')
      document.cookie = 'workspaceId=; path=/; max-age=0'
      document.cookie = 'clinicId=; path=/; max-age=0'
    } catch {}

    // Redirect to onboarding
    window.location.replace('/onboarding')
  }, [])

  return null
}

