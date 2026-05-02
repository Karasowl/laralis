'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

interface SwrProviderProps {
  children: ReactNode
}

/**
 * Global SWR Configuration Provider
 *
 * Provides default settings for all SWR hooks:
 * - Automatic revalidation on focus/reconnect
 * - Deduplication of requests
 * - Error retry with exponential backoff
 * - Cache persistence (optional, can be enabled for offline support)
 */
export function SwrProvider({ children }: SwrProviderProps) {
  return (
    <SWRConfig
      value={{
        // Revalidation settings
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        revalidateIfStale: true,

        // Deduplication - prevent duplicate requests within 2 seconds
        dedupingInterval: 2000,

        // Focus throttle - don't revalidate too frequently on focus
        focusThrottleInterval: 5000,

        // Error retry with exponential backoff
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
          // Don't retry on 404s
          if (error.message?.includes('404')) return

          // Don't retry on auth errors
          if (error.message?.includes('401') || error.message?.includes('403')) return

          // Only retry up to 3 times
          if (retryCount >= 3) return

          // Retry after exponential backoff
          setTimeout(() => revalidate({ retryCount }), 5000 * Math.pow(2, retryCount))
        },

        // Loading state
        keepPreviousData: true, // Keep showing old data while fetching new

        // Optional: Enable cache persistence for offline support
        // provider: () => new Map(), // Can be replaced with localStorage provider

        // Global error handler (for logging/monitoring)
        onError: (error, key) => {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[SWR Error] ${key}:`, error.message)
          }
          // In production, you could send to error tracking service
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
