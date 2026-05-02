'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOnboarding } from '@/hooks/use-onboarding'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { WelcomeStep } from '@/components/onboarding/WelcomeStep'
import { WorkspaceStep } from '@/components/onboarding/WorkspaceStep'
import { ClinicStep } from '@/components/onboarding/ClinicStep'
import { CompleteStep } from '@/components/onboarding/CompleteStep'
import { ChecklistStep } from '@/components/onboarding/ChecklistStep'

const clearOnboardingStorage = () => {
  try {
    const removable: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key === 'onboarding_progress' || key.startsWith('onboarding_progress:')) {
        removable.push(key)
      }
    }
    removable.forEach(key => localStorage.removeItem(key))
    // Nota: NO borramos las cookies/workspaceId/clinicId aquí para evitar
    // carreras justo después de crear la clínica. Esa limpieza completa se
    // hace únicamente en /setup/cancel.
  } catch {
    // ignore storage errors
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const clearedRef = useRef(false)
  if (typeof window !== 'undefined' && !clearedRef.current) {
    clearOnboardingStorage()
    clearedRef.current = true
  }

  useEffect(() => {
    clearOnboardingStorage()
  }, [])

  // Client guard: if user already has workspace AND clinic, prefer full setup page
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Check if user has workspace
        const { data: ws } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)

        if (ws && ws.length > 0) {
          const workspaceId = ws[0].id

          // Also check if workspace has at least one clinic
          const { data: clinic } = await supabase
            .from('clinics')
            .select('id')
            .eq('workspace_id', workspaceId)
            .limit(1)

          // Only redirect to /setup if BOTH workspace AND clinic exist
          if (clinic && clinic.length > 0) {
            router.replace('/setup')
          }
          // If workspace exists but no clinic, let onboarding continue to clinic creation step
        }
      } catch {}
    })()
  }, [router])

  const {
    steps,
    currentStep,
    data,
    loading,
    updateData,
    nextStep,
    previousStep,
    complete,
    isFirstStep,
    isLastStep,
    progress
  } = useOnboarding()

  const currentStepData = steps[currentStep]

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep />
      case 1:
        return <WorkspaceStep data={data} onChange={updateData} />
      case 2:
        return <ClinicStep data={data} onChange={updateData} />
      case 3:
        return (
          <ChecklistStep
            items={[
              { id: 'depreciation', label: 'Depreciación (activos/equipos)', href: '/assets' },
              { id: 'fixed_costs', label: 'Costos fijos mensuales', href: '/fixed-costs' },
              { id: 'cost_per_min', label: 'Configuración de tiempo / Costo por minuto', href: '/time' }
            ]}
          />
        )
      case 4:
        return (
          <ChecklistStep
            items={[
              { id: 'supplies', label: 'Insumos (presentación y porciones)', href: '/supplies' },
              { id: 'service_recipe', label: 'Recetas por servicio', href: '/services' }
            ]}
          />
        )
      case 5:
        return <CompleteStep data={data} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-gray-900 dark:via-teal-900 dark:to-cyan-900 flex items-center justify-center p-4">
      {/* Animated background blobs - matching login colors */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-300 dark:bg-teal-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-300 dark:bg-cyan-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-40 w-80 h-80 bg-primary/30 dark:bg-primary/40 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10">
        <OnboardingModal
          title={currentStepData.title}
          description={currentStepData.description}
          progress={progress}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          loading={loading}
          onNext={nextStep}
          onPrevious={previousStep}
          onComplete={complete}
        >
          {renderStep()}
        </OnboardingModal>
      </div>
    </div>
  )
}
