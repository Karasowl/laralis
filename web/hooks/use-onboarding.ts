'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { evaluateRequirements } from '@/lib/requirements'
import { useWorkspace } from '@/contexts/workspace-context'

export interface OnboardingData {
  workspaceName?: string
  workspaceType?: string
  clinicName?: string
  clinicAddress?: string
  clinicPhone?: string
  clinicEmail?: string
}

export interface OnboardingStep {
  id: number
  title: string
  description: string
  icon: string
}

export function useOnboarding() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const { user } = useWorkspace()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Partial<OnboardingData>>({})
  const [created, setCreated] = useState(false)

  // Define steps
  const steps: OnboardingStep[] = [
    {
      id: 0,
      title: t('welcomeTitle'),
      description: t('welcomeSubtitle'),
      icon: 'stars'
    },
    {
      id: 1,
      title: t('workspaceStep.title'),
      description: t('workspaceStep.subtitle'),
      icon: 'building'
    },
    {
      id: 2,
      title: t('clinicStep.title'),
      description: t('clinicStep.subtitle'),
      icon: 'stethoscope'
    },
    {
      id: 3,
      title: 'Base financiera',
      description: 'Completa depreciación, costos fijos y tiempo (costo por minuto) antes de continuar.',
      icon: 'calculator'
    },
    {
      id: 4,
      title: 'Catálogo y tarifas',
      description: 'Crea insumos, define recetas de servicios y calcula tarifas.',
      icon: 'list'
    },
    {
      id: 5,
      title: t('doneStep.title'),
      description: t('doneStep.subtitle'),
      icon: 'check'
    }
  ]

  // Namespaced storage key per user (avoids leaking data across sessions)
  const progressKey = (uid?: string | null) => `onboarding_progress:${uid || 'anon'}`

  // Load saved progress when user is known
  useEffect(() => {
    try {
      // Clean legacy key if present
      const legacy = localStorage.getItem('onboarding_progress')
      if (legacy) localStorage.removeItem('onboarding_progress')

      const saved = localStorage.getItem(progressKey(user?.id))
      if (saved) {
        const progress = JSON.parse(saved)
        if (progress?.step > 0) {
          setCurrentStep(progress.step)
          setData(progress.data)
        }
      }
    } catch {}
  }, [user?.id])

  // Save progress when step or data changes
  useEffect(() => {
    try {
      if (currentStep > 0) {
        localStorage.setItem(progressKey(user?.id), JSON.stringify({ step: currentStep, data }))
      }
    } catch {}
  }, [currentStep, data, user?.id])

  // Update data
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  // Validate current step
  const validateStep = useCallback((): boolean => {
    if (currentStep === 1) {
      if (!data.workspaceName) {
        toast.error(t('errors.workspaceNameRequired'))
        return false
      }
    } else if (currentStep === 2) {
      if (!data.clinicName) {
        toast.error(t('errors.clinicNameRequired'))
        return false
      }
    }
    return true
  }, [currentStep, data, t])

  // Async validation for requirements-based steps
  const validateStepAsync = useCallback(async (): Promise<boolean> => {
    // Try to read clinicId cookie for API validators; allow undefined to trigger server fallback
    const clinicId = ((): string | undefined => {
      if (typeof document === 'undefined') return undefined
      const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/)
      return m ? decodeURIComponent(m[1]) : undefined
    })()
    try {
      if (currentStep === 3) {
        // Financial base: depreciation, fixed costs, cost per minute
        const res = await evaluateRequirements({ clinicId: clinicId as any }, ['depreciation','fixed_costs','cost_per_min'] as any)
        if ((res.missing || []).length > 0) {
          toast.warning(`Faltan: ${res.missing.join(', ')}`)
          return false
        }
      }
      if (currentStep === 4) {
        // Catalog and tariffs: supplies, service recipe, tariffs
        const res = await evaluateRequirements({ clinicId: clinicId as any }, ['supplies','service_recipe','tariffs'] as any)
        if ((res.missing || []).length > 0) {
          toast.warning(`Faltan: ${res.missing.join(', ')}`)
          return false
        }
      }
      return true
    } catch (e) {
      toast.error(t('errors.genericDescription'))
      return false
    }
  }, [currentStep, t])

  // Go to next step
  const nextStep = useCallback(async () => {
    // First validate simple fields
    if (!validateStep()) return
    // If moving past clinic step, create workspace + clinic now to enable next requirements
    if (currentStep === 2 && !created) {
      try {
        setLoading(true)
        const response = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace: { name: data.workspaceName, description: data.workspaceType || '' },
            clinic: { name: data.clinicName, address: data.clinicAddress, phone: data.clinicPhone, email: data.clinicEmail }
          })
        })
        if (!response.ok) throw new Error('Failed to create workspace/clinic')
        // Persist cookies for clinic/workspace so validators target the new context
        try {
          const js = await response.json()
          const wsId = js?.workspace?.id
          const clinicId = js?.clinic?.id
          const maxAge = 60 * 60 * 24 * 30
          if (wsId) document.cookie = `workspaceId=${wsId}; path=/; max-age=${maxAge}`
          if (clinicId) document.cookie = `clinicId=${clinicId}; path=/; max-age=${maxAge}`
        } catch {}
        setCreated(true)
      } catch (e) {
        toast.error(t('errors.genericDescription'))
        setLoading(false)
        return
      } finally {
        setLoading(false)
      }
    }
    // For requirement steps, validate async before proceeding
    if (!(await validateStepAsync())) return
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep, created, data, t, validateStep, validateStepAsync, steps.length])

  // Go to previous step
  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  // Complete onboarding
  const complete = useCallback(async () => {
    if (!data.workspaceName || !data.clinicName) {
      toast.error(t('errors.missingRequiredFields'))
      return false
    }
    setLoading(true)
    try {
      // If not created earlier (unlikely), create now
      if (!created) {
        const response = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace: { name: data.workspaceName, description: data.workspaceType || '' },
            clinic: { name: data.clinicName, address: data.clinicAddress, phone: data.clinicPhone, email: data.clinicEmail }
          })
        })
        if (!response.ok) throw new Error('Failed to complete onboarding')
      }
      toast.success(t('success.description'))
      localStorage.removeItem('onboarding_progress')
      // Small delay and go home
      await new Promise(r => setTimeout(r, 300))
      window.location.href = '/'
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.genericDescription')
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [created, data, t])

  // Reset onboarding
  const reset = useCallback(() => {
    try {
      localStorage.removeItem('onboarding_progress')
      localStorage.removeItem(progressKey(user?.id))
    } catch {}
    setCurrentStep(0)
    setData({})
  }, [user?.id])

  return {
    steps,
    currentStep,
    data,
    loading,
    updateData,
    nextStep,
    previousStep,
    complete,
    reset,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
    progress: Math.round(((currentStep + 1) / steps.length) * 100)
  }
}
