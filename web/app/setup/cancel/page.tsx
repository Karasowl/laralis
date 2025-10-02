'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const clearClientState = (userId?: string | null) => {
  try {
    const removable: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (
        key === 'onboarding_progress' ||
        key.startsWith('onboarding_progress:') ||
        (userId && key === `onboarding_progress:${userId}`)
      ) {
        removable.push(key)
      }
    }
    removable.forEach(key => localStorage.removeItem(key))

    localStorage.removeItem('selectedWorkspaceId')
    localStorage.removeItem('selectedClinicId')
    document.cookie = 'workspaceId=; path=/; max-age=0'
    document.cookie = 'clinicId=; path=/; max-age=0'
  } catch {
    // ignore storage errors
  }
}

export default function CancelSetupPage() {
  useEffect(() => {
    let aborted = false
    const supabase = createClient()

    const run = async () => {
      let currentUserId: string | null = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        currentUserId = user?.id ?? null
      } catch {
        currentUserId = null
      }

      try {
        const response = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetType: 'initial_setup' })
        })

        if (!response.ok) {
          try {
            const payload = await response.json()
            console.error('Failed to reset initial setup', payload)
          } catch {
            console.error('Failed to reset initial setup', response.statusText)
          }
        }
      } catch (error) {
        console.error('Failed to reset initial setup', error)
      } finally {
        // Always clear client state after attempting the reset so the next session starts clean
        clearClientState(currentUserId)

        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          console.error('Failed to sign out after cancellation', signOutError)
        }

        if (!aborted) {
          window.location.replace('/auth/login')
        }
      }
    }

    void run()

    return () => {
      aborted = true
    }
  }, [])

  return null
}
