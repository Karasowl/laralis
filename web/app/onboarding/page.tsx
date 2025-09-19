'use client'

import { useOnboarding } from '@/hooks/use-onboarding'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { WelcomeStep } from '@/components/onboarding/WelcomeStep'
import { WorkspaceStep } from '@/components/onboarding/WorkspaceStep'
import { ClinicStep } from '@/components/onboarding/ClinicStep'
import { CompleteStep } from '@/components/onboarding/CompleteStep'
import { ChecklistStep } from '@/components/onboarding/ChecklistStep'
import { useEffect } from 'react'

export default function OnboardingPage() {
  // Clear stale context from previous sessions so onboarding starts clean
  useEffect(() => {
    try {
      localStorage.removeItem('selectedWorkspaceId')
      localStorage.removeItem('selectedClinicId')
      document.cookie = 'workspaceId=; path=/; max-age=0'
      document.cookie = 'clinicId=; path=/; max-age=0'
    } catch {}
  }, [])
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
              { id: 'service_recipe', label: 'Recetas por servicio', href: '/services' },
              { id: 'tariffs', label: 'Tarifas y redondeo', href: '/tariffs' }
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
        <div className="absolute top-40 left-40 w-80 h-80 bg-blue-300 dark:bg-blue-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-4000" />
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
