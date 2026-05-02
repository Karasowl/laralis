'use client'

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr'
import { useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

/**
 * SWR-based API hook with caching, revalidation, and mutations
 *
 * Benefits over plain fetch:
 * - Automatic caching with stale-while-revalidate
 * - Deduplication of requests
 * - Focus/reconnect revalidation
 * - Optimistic updates support
 * - Global cache invalidation
 */

interface SwrApiOptions extends SWRConfiguration {
  /** Show toast on error (default: false for GET, true for mutations) */
  showErrorToast?: boolean
  /** Custom error message for toast */
  errorMessage?: string
}

interface MutationOptions {
  /** Show success toast after mutation */
  showSuccessToast?: boolean
  /** Custom success message */
  successMessage?: string
  /** Show error toast on failure */
  showErrorToast?: boolean
  /** Custom error message */
  errorMessage?: string
  /** Optimistic data to show immediately */
  optimisticData?: any
  /** Revalidate after mutation (default: true) */
  revalidate?: boolean
  /** Additional endpoints to revalidate */
  revalidateKeys?: string[]
}

// Global fetcher function
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    let errorMessage = 'API Error'
    try {
      const data = JSON.parse(text)
      errorMessage = data.error || data.message || errorMessage
    } catch {
      errorMessage = response.statusText || errorMessage
    }
    throw new Error(errorMessage)
  }

  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * SWR-based hook for GET requests with automatic caching
 *
 * @example
 * // Basic usage
 * const { data, error, loading, refresh } = useSwrApi<Patient[]>('/api/patients')
 *
 * @example
 * // With options
 * const { data } = useSwrApi<Patient[]>('/api/patients', {
 *   refreshInterval: 30000, // Refresh every 30 seconds
 *   revalidateOnFocus: false,
 * })
 *
 * @example
 * // Conditional fetching
 * const { data } = useSwrApi<Patient[]>(clinicId ? `/api/patients?clinicId=${clinicId}` : null)
 */
export function useSwrApi<T = any>(
  endpoint: string | null,
  options: SwrApiOptions = {}
) {
  const { toast } = useToast()
  const t = useTranslations()
  const { showErrorToast = false, errorMessage, ...swrOptions } = options

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    endpoint,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000, // Dedupe requests within 2 seconds
      ...swrOptions,
      onError: (err) => {
        if (showErrorToast) {
          toast({
            title: errorMessage || t('common.error'),
            description: err.message,
            variant: 'destructive',
          })
        }
        swrOptions.onError?.(err, endpoint || '', swrOptions as any)
      },
    }
  )

  const refresh = useCallback(() => mutate(), [mutate])

  return {
    data: data ?? null,
    error: error?.message ?? null,
    loading: isLoading,
    isValidating,
    refresh,
    mutate,
  }
}

/**
 * Hook for mutations (POST, PUT, PATCH, DELETE) with cache invalidation
 *
 * @example
 * const { mutateApi, loading } = useSwrMutation()
 *
 * // Create
 * await mutateApi('/api/patients', {
 *   method: 'POST',
 *   body: { name: 'John' },
 *   revalidateKeys: ['/api/patients'],
 *   showSuccessToast: true,
 * })
 *
 * // Update with optimistic UI
 * await mutateApi(`/api/patients/${id}`, {
 *   method: 'PUT',
 *   body: updatedPatient,
 *   optimisticData: updatedPatient,
 *   revalidateKeys: ['/api/patients', `/api/patients/${id}`],
 * })
 */
export function useSwrMutation() {
  const { toast } = useToast()
  const t = useTranslations()

  const mutateApi = useCallback(async <T = any>(
    endpoint: string,
    options: MutationOptions & {
      method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: any
      headers?: Record<string, string>
    } = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    const {
      method = 'POST',
      body,
      headers = {},
      showSuccessToast = false,
      successMessage,
      showErrorToast = true,
      errorMessage,
      revalidate = true,
      revalidateKeys = [],
    } = options

    try {
      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
      })

      const text = await response.text()
      let data: T | null = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          data = text as any
        }
      }

      if (!response.ok) {
        const errorMsg = data && typeof data === 'object'
          ? ((data as any).error || (data as any).message || 'API Error')
          : response.statusText || 'API Error'
        throw new Error(errorMsg)
      }

      // Revalidate cache
      if (revalidate) {
        // Revalidate the endpoint itself
        await globalMutate(endpoint)

        // Revalidate additional keys
        for (const key of revalidateKeys) {
          await globalMutate(key)
        }
      }

      if (showSuccessToast) {
        toast({
          title: successMessage || t('common.success'),
          variant: 'default',
        })
      }

      return { success: true, data: data as T }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      if (showErrorToast) {
        toast({
          title: errorMessage || t('common.error'),
          description: errorMsg,
          variant: 'destructive',
        })
      }

      return { success: false, error: errorMsg }
    }
  }, [toast, t])

  return { mutateApi }
}

/**
 * Utility to invalidate cache for specific endpoints
 * Useful when you need to refresh data from outside a component
 *
 * @example
 * // Invalidate a single endpoint
 * invalidateCache('/api/patients')
 *
 * // Invalidate multiple endpoints
 * invalidateCache(['/api/patients', '/api/treatments'])
 *
 * // Invalidate all endpoints matching a pattern (using filter)
 * invalidateCache((key) => key.startsWith('/api/patients'))
 */
export function invalidateCache(
  keyOrKeys: string | string[] | ((key: string) => boolean)
) {
  if (typeof keyOrKeys === 'function') {
    // For function filters, we need to match against all cached keys
    // This is a simplified version - in production you might want
    // to use SWR's cache API directly
    globalMutate(keyOrKeys)
  } else if (Array.isArray(keyOrKeys)) {
    keyOrKeys.forEach((key) => globalMutate(key))
  } else {
    globalMutate(keyOrKeys)
  }
}

/**
 * Prefetch data into SWR cache
 * Useful for preloading data before navigation
 *
 * @example
 * // Prefetch patient data before navigating
 * await prefetchData('/api/patients/123')
 */
export async function prefetchData<T = any>(endpoint: string): Promise<T | null> {
  try {
    const data = await fetcher(endpoint)
    globalMutate(endpoint, data, false) // false = don't revalidate
    return data
  } catch {
    return null
  }
}
