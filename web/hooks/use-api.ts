'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  showSuccessToast?: boolean
  showErrorToast?: boolean
  successMessage?: string
  errorMessage?: string
}

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

type UseApiOptions = {
  autoFetch?: boolean
}

export function useApi<T = any>(endpoint: string, opts: UseApiOptions = {}) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null
  })
  const { toast } = useToast()
  const t = useTranslations()

  const execute = useCallback(async (options: ApiOptions = {}) => {
    const {
      method = 'GET',
      body,
      headers = {},
      showSuccessToast = false,
      showErrorToast = true,
      successMessage,
      errorMessage
    } = options

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        ...(body && { body: JSON.stringify(body) })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'API Error')
      }

      setState({ data: data.data || data, loading: false, error: null })

      if (showSuccessToast) {
        toast({
          title: successMessage || t('common.success'),
          variant: 'default'
        })
      }

      return { success: true, data: data.data || data }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setState({ data: null, loading: false, error: errorMsg })

      if (showErrorToast) {
        toast({
          title: errorMessage || t('common.error'),
          description: errorMsg,
          variant: 'destructive'
        })
      }

      return { success: false, error: errorMsg }
    }
  }, [endpoint, toast, t])

  const get = useCallback(() => execute({ method: 'GET' }), [execute])
  
  const post = useCallback((body: any, options?: Omit<ApiOptions, 'method' | 'body'>) => 
    execute({ method: 'POST', body, ...options }), [execute])
  
  const put = useCallback((body: any, options?: Omit<ApiOptions, 'method' | 'body'>) => 
    execute({ method: 'PUT', body, ...options }), [execute])
  
  const patch = useCallback((body: any, options?: Omit<ApiOptions, 'method' | 'body'>) => 
    execute({ method: 'PATCH', body, ...options }), [execute])
  
  const del = useCallback((options?: Omit<ApiOptions, 'method'>) => 
    execute({ method: 'DELETE', ...options }), [execute])

  // Optional auto-fetch on mount/update when endpoint changes
  // Keep dependencies minimal to avoid infinite loops due to unstable callbacks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (opts.autoFetch && endpoint) {
      // fire-and-forget; state updates handled inside execute
      execute({ method: 'GET' })
    }
  }, [opts.autoFetch, endpoint])

  return {
    ...state,
    execute,
    get,
    post,
    put,
    patch,
    delete: del
  }
}

// Hook para múltiples llamadas paralelas
export function useParallelApi() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const t = useTranslations()

  const fetchAll = useCallback(async <T extends any[]>(
    requests: Array<{ endpoint: string; options?: ApiOptions }>
  ): Promise<T> => {
    setLoading(true)

    // Helper with timeout and graceful JSON parsing
    const doRequest = async (endpoint: string, options: ApiOptions = {}, timeoutMs = 8000) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(endpoint, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          credentials: 'include',
          ...(options.body && { body: JSON.stringify(options.body) }),
          signal: controller.signal
        })
        const text = await res.text()
        let data: any = null
        try { data = text ? JSON.parse(text) : null } catch { data = null }
        if (!res.ok) {
          const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`
          throw new Error(msg)
        }
        return data
      } finally {
        clearTimeout(timer)
      }
    }

    try {
      const settled = await Promise.allSettled(
        requests.map(({ endpoint, options = {} }) => doRequest(endpoint, options))
      )

      const failures = settled.filter(s => s.status === 'rejected') as PromiseRejectedResult[]
      if (failures.length > 0) {
        // Show a single toast but still return partial results
        const firstMsg = failures[0].reason instanceof Error ? failures[0].reason.message : String(failures[0].reason)
        toast({
          title: t('common.error'),
          description: `${firstMsg}${failures.length > 1 ? ` (+${failures.length - 1} más)` : ''}`,
          variant: 'destructive'
        })
      }

      const results = settled.map(s => (s.status === 'fulfilled' ? s.value : {})) as T
      setLoading(false)
      return results
    } catch (error) {
      setLoading(false)
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
      throw error
    }
  }, [toast, t])

  return { fetchAll, loading }
}
