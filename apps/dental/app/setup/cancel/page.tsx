'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const getCookieValue = (name: string) => {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

const getSelectedWorkspaceId = () => {
  try {
    return getCookieValue('workspaceId') || localStorage.getItem('selectedWorkspaceId')
  } catch {
    return getCookieValue('workspaceId')
  }
}

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

const hasCompletedWorkspace = async (supabase: ReturnType<typeof createClient>, userId: string | null) => {
  if (!userId) return false

  const selectedWorkspaceId = getSelectedWorkspaceId()

  if (selectedWorkspaceId) {
    const { data: selectedWorkspace } = await supabase
      .from('workspaces')
      .select('id, onboarding_completed')
      .eq('id', selectedWorkspaceId)
      .maybeSingle()

    if (selectedWorkspace?.onboarding_completed === true) {
      return true
    }

    return false
  }

  const { data: completedWorkspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .eq('onboarding_completed', true)
    .limit(1)

  return Boolean(completedWorkspaces?.length)
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
        if (await hasCompletedWorkspace(supabase, currentUserId)) {
          if (!aborted) {
            window.location.replace('/')
          }
          return
        }
      } catch (error) {
        console.error('Failed to verify setup cancellation safety', error)
        if (!aborted) {
          window.location.replace('/')
        }
        return
      }

      clearClientState(currentUserId)

      try {
        await supabase.auth.signOut()
      } catch (signOutError) {
        console.error('Failed to sign out after cancellation', signOutError)
      } finally {
        if (!aborted) {
          window.location.replace('/auth/login')
          return
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
