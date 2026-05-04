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

type CompletedWorkspaceSelection = {
  workspaceId: string
  workspaceName?: string | null
  clinicId?: string | null
  clinicName?: string | null
}

const normalizeWorkspaceStatus = (workspace: any) => {
  return workspace?.status || (workspace?.onboarding_completed ? 'active' : 'draft')
}

const restoreCompletedWorkspaceState = async (selection: CompletedWorkspaceSelection) => {
  const maxAge = 60 * 60 * 24 * 30
  document.cookie = `workspaceId=${selection.workspaceId}; path=/; max-age=${maxAge}`
  localStorage.setItem('selectedWorkspaceId', selection.workspaceId)
  if (selection.workspaceName) localStorage.setItem('selectedWorkspaceName', selection.workspaceName)

  if (selection.clinicId) {
    document.cookie = `clinicId=${selection.clinicId}; path=/; max-age=${maxAge}`
    localStorage.setItem('selectedClinicId', selection.clinicId)
    if (selection.clinicName) localStorage.setItem('selectedClinicName', selection.clinicName)

    try {
      await fetch('/api/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clinicId: selection.clinicId }),
      })
    } catch (error) {
      console.error('Failed to restore server clinic/workspace cookies', error)
    }
  }
}

const firstClinicForWorkspace = async (workspaceId: string) => {
  const response = await fetch(`/api/workspaces/${workspaceId}/clinics`, {
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) return null

  const payload = await response.json().catch(() => ({}))
  const clinics = Array.isArray(payload?.data) ? payload.data : []
  return clinics.find((clinic: any) => clinic?.is_active !== false) || clinics[0] || null
}

const resolveCompletedWorkspace = async (
  supabase: ReturnType<typeof createClient>,
  userId: string | null
): Promise<CompletedWorkspaceSelection | null> => {
  if (!userId) return null
  const selectedWorkspaceId = getSelectedWorkspaceId()

  try {
    const response = await fetch('/api/workspaces?list=true', {
      credentials: 'include',
      cache: 'no-store',
    })

    if (response.ok) {
      const workspaces = await response.json().catch(() => [])
      const rows = Array.isArray(workspaces) ? workspaces : []
      const completedRows = rows.filter((workspace: any) => normalizeWorkspaceStatus(workspace) === 'active')
      const selectedCompleted = completedRows.find((workspace: any) => workspace.id === selectedWorkspaceId)
      const workspace = selectedCompleted || completedRows[0]

      if (workspace?.id) {
        const clinic = await firstClinicForWorkspace(workspace.id)
        return {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          clinicId: clinic?.id ?? null,
          clinicName: clinic?.name ?? null,
        }
      }
    }
  } catch (error) {
    console.error('Failed to resolve completed workspace through API', error)
  }

  // Fallback for unusual API failures: check owned active workspaces directly.
  const { data: completedWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', userId)
    .eq('onboarding_completed', true)
    .limit(1)

  const workspace = completedWorkspaces?.[0]
  if (!workspace?.id) return null

  const clinic = await firstClinicForWorkspace(workspace.id)
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    clinicId: clinic?.id ?? null,
    clinicName: clinic?.name ?? null,
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
        const completedWorkspace = await resolveCompletedWorkspace(supabase, currentUserId)
        if (completedWorkspace) {
          await restoreCompletedWorkspaceState(completedWorkspace)
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
