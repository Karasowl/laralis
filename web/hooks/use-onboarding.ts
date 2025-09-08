'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

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
  
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Partial<OnboardingData>>({})

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
      title: t('doneStep.title'),
      description: t('doneStep.subtitle'),
      icon: 'check'
    }
  ]

  // Load saved progress on mount
  useEffect(() => {
    const saved = localStorage.getItem('onboarding_progress')
    if (saved) {
      const progress = JSON.parse(saved)
      if (progress.step > 0) {
        setCurrentStep(progress.step)
        setData(progress.data)
      }
    }
  }, [])

  // Save progress when step or data changes
  useEffect(() => {
    if (currentStep > 0) {
      localStorage.setItem('onboarding_progress', JSON.stringify({
        step: currentStep,
        data
      }))
    }
  }, [currentStep, data])

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

  // Go to next step
  const nextStep = useCallback(() => {
    if (validateStep() && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep, steps.length, validateStep])

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
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: {
            name: data.workspaceName,
            description: data.workspaceDescription
          },
          clinic: {
            name: data.clinicName,
            address: data.clinicAddress,
            phone: data.clinicPhone,
            email: data.clinicEmail
          }
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to complete onboarding')
      }
      
      toast.success(t('success.description'))
      localStorage.removeItem('onboarding_progress')
      
      // Wait for context to update
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Force reload to update context
      window.location.href = '/'
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.genericDescription')
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [data, t])

  // Reset onboarding
  const reset = useCallback(() => {
    localStorage.removeItem('onboarding_progress')
    setCurrentStep(0)
    setData({})
  }, [])

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