'use client'

import { useState, useCallback } from 'react'
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

export function useApi<T = any>(endpoint: string) {
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
    
    try {
      const promises = requests.map(({ endpoint, options = {} }) => 
        fetch(endpoint, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          ...(options.body && { body: JSON.stringify(options.body) })
        }).then(res => res.json())
      )

      const results = await Promise.all(promises)
      setLoading(false)
      return results as T
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