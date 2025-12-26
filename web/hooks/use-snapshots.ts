'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useApi } from './use-api'
import { useCurrentClinic } from './use-current-clinic'
import { useToast } from './use-toast'
import type {
  SnapshotMetadata,
  SnapshotStats,
  RestoreResult,
  RestoreMode,
  DiscoveredTable,
} from '@/lib/snapshots/types'

// ============================================================================
// Types
// ============================================================================

export interface SnapshotListItem {
  id: string
  clinicId: string
  createdAt: string
  type: 'manual' | 'scheduled' | 'pre-restore'
  status: 'pending' | 'completed' | 'failed'
  checksum: string
  compressedSizeBytes: number | null
  uncompressedSizeBytes: number | null
  recordCounts: Record<string, number>
  schemaVersion: number
  createdBy: string | null
  tableManifest: Array<{
    name: string
    category: string
    recordCount: number
  }> | null
}

export interface CreateSnapshotResult {
  success: boolean
  snapshotId?: string
  stats?: SnapshotStats
  error?: string
}

export interface RestoreSnapshotResult {
  success: boolean
  result?: RestoreResult
  error?: string
}

export interface DiscoveryResult {
  tables: (DiscoveredTable & { recordCount?: number })[]
  foreignKeyOrder: string[]
  discoveredAt: string
  method: 'dynamic'
  summary: {
    totalTables: number
    directTables: number
    indirectTables: number
    hybridTables: number
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useSnapshots() {
  const t = useTranslations('snapshots')
  const { toast } = useToast()
  const { currentClinic } = useCurrentClinic()
  const clinicId = currentClinic?.id || null

  // State
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)

  // API hooks
  const listApi = useApi<{ snapshots: SnapshotListItem[] }>('/api/snapshots', { autoFetch: false })

  // ============================================================================
  // Fetch snapshots
  // ============================================================================

  const fetchSnapshots = useCallback(async () => {
    if (!clinicId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/snapshots?clinicId=${clinicId}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch snapshots')
      }
      const data = await response.json()
      setSnapshots(data.snapshots || [])
    } catch (error) {
      console.error('Error fetching snapshots:', error)
      toast({
        title: t('errors.fetchFailed'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [clinicId, toast, t])

  // ============================================================================
  // Create snapshot
  // ============================================================================

  const createSnapshot = useCallback(async (
    type: 'manual' | 'scheduled' = 'manual'
  ): Promise<CreateSnapshotResult> => {
    if (!clinicId) {
      return { success: false, error: 'No clinic selected' }
    }

    setCreating(true)
    try {
      const response = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create snapshot')
      }

      toast({
        title: t('createSuccess'),
        description: t('createSuccessDesc', {
          records: data.stats?.totalRecords || 0,
        }),
      })

      // Refresh list
      await fetchSnapshots()

      return {
        success: true,
        snapshotId: data.snapshotId,
        stats: data.stats,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      toast({
        title: t('errors.createFailed'),
        description: errorMsg,
        variant: 'destructive',
      })
      return { success: false, error: errorMsg }
    } finally {
      setCreating(false)
    }
  }, [clinicId, toast, t, fetchSnapshots])

  // ============================================================================
  // Delete snapshot
  // ============================================================================

  const deleteSnapshot = useCallback(async (snapshotId: string): Promise<boolean> => {
    setDeleting(snapshotId)
    try {
      const response = await fetch(`/api/snapshots/${snapshotId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete snapshot')
      }

      toast({
        title: t('deleteSuccess'),
      })

      // Refresh list
      await fetchSnapshots()
      return true
    } catch (error) {
      toast({
        title: t('errors.deleteFailed'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      return false
    } finally {
      setDeleting(null)
    }
  }, [toast, t, fetchSnapshots])

  // ============================================================================
  // Restore snapshot
  // ============================================================================

  const restoreSnapshot = useCallback(async (
    snapshotId: string,
    options?: {
      mode?: RestoreMode
      createBackupFirst?: boolean
      tables?: string[]
      dryRun?: boolean
    }
  ): Promise<RestoreSnapshotResult> => {
    setRestoring(snapshotId)
    try {
      const response = await fetch(`/api/snapshots/${snapshotId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: options?.mode || 'replace',
          createBackupFirst: options?.createBackupFirst ?? true,
          tables: options?.tables,
          dryRun: options?.dryRun ?? false,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Restore failed')
      }

      if (!options?.dryRun) {
        toast({
          title: t('restoreSuccess'),
          description: t('restoreSuccessDesc', {
            records: Object.values(data.restoredRecords as Record<string, number>).reduce(
              (a, b) => a + b,
              0
            ),
          }),
        })

        // Refresh list (will include new pre-restore backup)
        await fetchSnapshots()
      }

      return { success: true, result: data }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      toast({
        title: t('errors.restoreFailed'),
        description: errorMsg,
        variant: 'destructive',
      })
      return { success: false, error: errorMsg }
    } finally {
      setRestoring(null)
    }
  }, [toast, t, fetchSnapshots])

  // ============================================================================
  // Download snapshot
  // ============================================================================

  const downloadSnapshot = useCallback(async (snapshotId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/snapshots/${snapshotId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to download snapshot')
      }

      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `snapshot-${snapshotId}.json.gz`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      // Create download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: t('downloadSuccess'),
      })
    } catch (error) {
      toast({
        title: t('errors.downloadFailed'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }, [toast, t])

  // ============================================================================
  // Discover tables
  // ============================================================================

  const discoverTables = useCallback(async (
    includeCounts = false
  ): Promise<DiscoveryResult | null> => {
    if (!clinicId) return null

    try {
      const url = `/api/snapshots/discover?clinicId=${clinicId}${includeCounts ? '&counts=true' : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Discovery failed')
      }

      const data = await response.json()
      setDiscovery(data)
      return data
    } catch (error) {
      console.error('Error discovering tables:', error)
      return null
    }
  }, [clinicId])

  // ============================================================================
  // Get snapshot metadata
  // ============================================================================

  const getSnapshotMetadata = useCallback(async (
    snapshotId: string
  ): Promise<SnapshotMetadata | null> => {
    try {
      const response = await fetch(`/api/snapshots/${snapshotId}?metadata=true`)

      if (!response.ok) {
        throw new Error('Failed to get snapshot metadata')
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting snapshot metadata:', error)
      return null
    }
  }, [])

  // ============================================================================
  // Auto-fetch on mount/clinic change
  // ============================================================================

  useEffect(() => {
    if (clinicId) {
      fetchSnapshots()
    }
  }, [clinicId, fetchSnapshots])

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Data
    snapshots,
    discovery,

    // Loading states
    loading,
    creating,
    restoring,
    deleting,

    // Actions
    fetchSnapshots,
    createSnapshot,
    deleteSnapshot,
    restoreSnapshot,
    downloadSnapshot,
    discoverTables,
    getSnapshotMetadata,

    // Helpers
    // For now, assume user is owner if they have access. API will reject if not.
    isOwner: !!currentClinic,
    hasSnapshots: snapshots.length > 0,
  }
}
