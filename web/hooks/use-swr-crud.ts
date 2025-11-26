'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useWorkspace } from '@/contexts/workspace-context'
import { useCurrentClinic } from '@/hooks/use-current-clinic'

/**
 * SWR-based CRUD operations hook with caching
 *
 * Benefits over useCrudOperations:
 * - Automatic caching with stale-while-revalidate
 * - Deduplication of requests (multiple components using same endpoint share cache)
 * - Background revalidation on focus/reconnect
 * - Optimistic updates support
 * - Reduced network requests
 */

interface SwrCrudConfig<T> {
  endpoint: string
  entityName: string
  includeClinicId?: boolean
  searchParam?: string
  staticParams?: Record<string, string>
  transformData?: (data: any) => T
  /** SWR refresh interval in ms (default: 0 = no auto refresh) */
  refreshInterval?: number
  /** Revalidate on window focus (default: true) */
  revalidateOnFocus?: boolean
}

interface SwrCrudState<T> {
  items: T[]
  loading: boolean
  isValidating: boolean
  isSubmitting: boolean
  editingItem: T | null
  isDialogOpen: boolean
  deleteConfirmOpen: boolean
  deletingItem: T | null
  searchTerm: string
}

interface SwrCrudActions<T> {
  refresh: () => Promise<void>
  handleCreate: (data: any) => Promise<boolean>
  handleUpdate: (id: string, data: any) => Promise<boolean>
  handleDelete: (id: string) => Promise<boolean>
  handleEdit: (item: T) => void
  handleDeleteClick: (item: T) => void
  handleDeleteConfirm: () => Promise<void>
  openDialog: () => void
  closeDialog: () => void
  setSearchTerm: (term: string) => void
  reset: () => void
}

// Fetcher with credentials
const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    const text = await response.text()
    let errorMsg = 'API Error'
    try {
      const data = JSON.parse(text)
      errorMsg = data.error || data.message || errorMsg
    } catch {
      errorMsg = response.statusText || errorMsg
    }
    throw new Error(errorMsg)
  }
  const result = await response.json()
  return result.data || result || []
}

export function useSwrCrud<T extends { id: string; name?: string }>(
  config: SwrCrudConfig<T>
): SwrCrudState<T> & SwrCrudActions<T> {
  const t = useTranslations()
  const { currentClinic } = useWorkspace()
  const { currentClinic: fallbackClinic } = useCurrentClinic()

  // UI State (not cached)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingItem, setEditingItem] = useState<T | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<T | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Resolve clinic ID
  const clinicId = useMemo(() => {
    let id = currentClinic?.id || fallbackClinic?.id
    if (!id) {
      try {
        if (typeof document !== 'undefined') {
          const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/)
          if (m) id = decodeURIComponent(m[1])
        }
        if (!id && typeof localStorage !== 'undefined') {
          id = localStorage.getItem('selectedClinicId') || undefined
        }
      } catch {}
    }
    return id
  }, [currentClinic?.id, fallbackClinic?.id])

  // Build SWR key (URL)
  const swrKey = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const urlObj = new URL(config.endpoint, base)

    if (config.includeClinicId && clinicId) {
      urlObj.searchParams.set('clinic_id', clinicId)
      urlObj.searchParams.set('clinicId', clinicId)
    }

    if (config.staticParams) {
      for (const [k, v] of Object.entries(config.staticParams)) {
        urlObj.searchParams.set(k, v)
      }
    }

    if (debouncedSearch && config.searchParam) {
      urlObj.searchParams.set(config.searchParam, debouncedSearch)
    }

    return urlObj.pathname + urlObj.search
  }, [config.endpoint, config.includeClinicId, config.staticParams, config.searchParam, clinicId, debouncedSearch])

  // SWR for data fetching
  const { data, error, isLoading, isValidating, mutate } = useSWR<T[]>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: config.revalidateOnFocus ?? true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      refreshInterval: config.refreshInterval || 0,
      keepPreviousData: true,
    }
  )

  // Transform data if needed
  const items = useMemo(() => {
    if (!data) return []
    return config.transformData ? data.map(config.transformData) : data
  }, [data, config.transformData])

  // Refresh function
  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  // Create handler
  const handleCreate = useCallback(async (createData: any): Promise<boolean> => {
    setIsSubmitting(true)
    try {
      const payload = config.includeClinicId && clinicId
        ? { ...createData, clinic_id: clinicId }
        : createData

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        if (response.status === 412) {
          const error = await response.json().catch(() => ({}))
          toast.warning(error?.message || 'Missing prerequisites', { duration: 8000 })
          return false
        }
        const error = await response.json()
        throw new Error(error.message || error.error)
      }

      toast.success(t('common.createSuccess', { entity: config.entityName }))

      // Invalidate cache to refetch
      await mutate()

      return true
    } catch (err) {
      console.error(`Error creating ${config.entityName}:`, err)
      toast.error(err instanceof Error ? err.message : t('common.createError'))
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [config.endpoint, config.entityName, config.includeClinicId, clinicId, mutate, t])

  // Update handler
  const handleUpdate = useCallback(async (id: string, updateData: any): Promise<boolean> => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`${config.endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error)
      }

      toast.success(t('common.updateSuccess', { entity: config.entityName }))

      // Invalidate cache
      await mutate()

      return true
    } catch (err) {
      console.error(`Error updating ${config.entityName}:`, err)
      toast.error(err instanceof Error ? err.message : t('common.updateError'))
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [config.endpoint, config.entityName, mutate, t])

  // Delete handler
  const handleDelete = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${config.endpoint}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error)
      }

      toast.success(t('common.deleteSuccess', { entity: config.entityName }))

      // Invalidate cache
      await mutate()

      return true
    } catch (err) {
      console.error(`Error deleting ${config.entityName}:`, err)
      toast.error(err instanceof Error ? err.message : t('common.deleteError'))
      return false
    }
  }, [config.endpoint, config.entityName, mutate, t])

  // UI handlers
  const handleEdit = useCallback((item: T) => {
    setEditingItem(item)
    setIsDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback((item: T) => {
    setDeletingItem(item)
    setDeleteConfirmOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingItem) return
    const success = await handleDelete(deletingItem.id)
    if (success) {
      setDeleteConfirmOpen(false)
      setDeletingItem(null)
    }
  }, [deletingItem, handleDelete])

  const openDialog = useCallback(() => {
    setEditingItem(null)
    setIsDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false)
    setEditingItem(null)
    setDeleteConfirmOpen(false)
    setDeletingItem(null)
  }, [])

  const reset = useCallback(() => {
    setEditingItem(null)
    setIsDialogOpen(false)
    setDeleteConfirmOpen(false)
    setDeletingItem(null)
    setSearchTerm('')
  }, [])

  return {
    // State
    items,
    loading: isLoading,
    isValidating,
    isSubmitting,
    editingItem,
    isDialogOpen,
    deleteConfirmOpen,
    deletingItem,
    searchTerm,

    // Actions
    refresh,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    openDialog,
    closeDialog,
    setSearchTerm,
    reset,
  }
}

/**
 * Invalidate all CRUD caches matching a pattern
 * Useful when an action affects multiple entities
 *
 * @example
 * // After deleting a patient, also invalidate treatments
 * invalidateCrudCache(['/api/patients', '/api/treatments'])
 */
export function invalidateCrudCache(endpoints: string[]) {
  endpoints.forEach(endpoint => {
    // Use a filter to match all cache keys starting with the endpoint
    globalMutate(
      key => typeof key === 'string' && key.startsWith(endpoint),
      undefined,
      { revalidate: true }
    )
  })
}
