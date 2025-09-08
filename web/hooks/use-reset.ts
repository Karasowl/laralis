'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useApi } from './use-api'

export interface ResetOption {
  id: string
  label: string
  description: string
  danger: boolean
  tables?: string[]
}

export interface ResetStatus {
  patients: number
  treatments: number
  expenses: number
  supplies: number
  services: number
  assets: number
  fixed_costs: number
  tariffs: number
  clinics: number
  totalRecords: number
}

type ResetProgress = { [key: string]: 'pending' | 'success' | 'error' }

export function useReset() {
  const t = useTranslations('settings')
  
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [resetProgress, setResetProgress] = useState<ResetProgress>({})
  const [dataStatus, setDataStatus] = useState<ResetStatus | null>(null)
  const [confirmText, setConfirmText] = useState('')

  // Define reset options directly
  const resetOptions: ResetOption[] = [
    {
      id: 'patients',
      label: t('reset.patients'),
      description: t('reset.patients_desc'),
      danger: false,
      tables: ['patients', 'treatments']
    },
    {
      id: 'treatments',
      label: t('reset.treatments'),
      description: t('reset.treatments_desc'),
      danger: false,
      tables: ['treatments']
    },
    {
      id: 'expenses',
      label: t('reset.expenses'),
      description: t('reset.expenses_desc'),
      danger: false,
      tables: ['expenses']
    },
    {
      id: 'supplies',
      label: t('reset.supplies'),
      description: t('reset.supplies_desc'),
      danger: false,
      tables: ['supplies', 'service_supplies']
    },
    {
      id: 'services',
      label: t('reset.services'),
      description: t('reset.services_desc'),
      danger: false,
      tables: ['services', 'service_supplies']
    },
    {
      id: 'assets',
      label: t('reset.assets'),
      description: t('reset.assets_desc'),
      danger: false,
      tables: ['assets']
    },
    {
      id: 'all_data',
      label: t('reset.all_data'),
      description: t('reset.all_data_desc'),
      danger: true,
      tables: ['*']
    }
  ]

  // Toggle option selection
  const toggleOption = useCallback((optionId: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId)
      }
      // If selecting "all_data", deselect everything else
      if (optionId === 'all_data') {
        return [optionId]
      }
      // If selecting something else, deselect "all_data"
      return [...prev.filter(id => id !== 'all_data'), optionId]
    })
  }, [])

  // Fetch data status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/reset/status')
      if (response.ok) {
        const status = await response.json()
        setDataStatus(status)
      }
    } catch (error) {
      console.error('Error fetching data status:', error)
    }
  }, [])

  // Perform reset
  const performReset = useCallback(async (): Promise<boolean> => {
    if (selectedOptions.length === 0) {
      toast.error(t('reset.select_options'))
      return false
    }

    // Extra validation for dangerous options
    if (selectedOptions.includes('all_data')) {
      if (confirmText !== 'BORRAR TODO') {
        toast.error(t('reset.confirm_required'))
        return false
      }
    }

    if (!confirm(t('reset.confirm_message'))) {
      return false
    }

    setLoading(true)
    const progress: ResetProgress = {}
    let successCount = 0
    let errorCount = 0
    const results: string[] = []

    for (const option of selectedOptions) {
      progress[option] = 'pending'
      setResetProgress({ ...progress })

      try {
        const response = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ option })
        })
        
        if (response.ok) {
          const result = await response.json()
          progress[option] = 'success'
          successCount++
          
          const optionLabel = resetOptions.find(o => o.id === option)?.label || option
          results.push(`✓ ${optionLabel}: ${result.message || 'Completado'}`)
        } else {
          throw new Error('Reset failed')
        }
      } catch (error) {
        progress[option] = 'error'
        errorCount++
        
        const optionLabel = resetOptions.find(o => o.id === option)?.label || option
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
        results.push(`✗ ${optionLabel}: ${errorMsg}`)
      }

      setResetProgress({ ...progress })
    }

    setLoading(false)

    // Show summary notification
    if (errorCount === 0) {
      toast.success(t('reset.success'), {
        description: results.join('\n')
      })
    } else if (successCount > 0) {
      toast.warning(t('reset.partial_success'), {
        description: `${successCount} exitosos, ${errorCount} con errores\n${results.join('\n')}`
      })
    } else {
      toast.error(t('reset.error'))
    }

    // If all data was deleted, redirect to onboarding
    if (selectedOptions.includes('all_data') && successCount > 0) {
      setTimeout(() => {
        window.location.href = '/onboarding'
      }, 2000)
      return true
    }

    // Clear selection after completion
    setTimeout(() => {
      setSelectedOptions([])
      setResetProgress({})
      setConfirmText('')
      fetchStatus()
    }, 3000)

    return successCount > 0
  }, [selectedOptions, confirmText, resetOptions, t, fetchStatus])

  // Load status on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return {
    resetOptions,
    selectedOptions,
    loading,
    resetProgress,
    dataStatus,
    confirmText,
    setConfirmText,
    toggleOption,
    performReset,
    fetchStatus
  }
}