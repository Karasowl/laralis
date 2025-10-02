'use client'

import { useCallback } from 'react'
import { SimpleModal } from '@/components/ui/form-modal'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface OnboardingModalProps {
  title: string
  description: string
  progress: number
  isFirstStep: boolean
  isLastStep: boolean
  loading?: boolean
  onNext: () => void
  onPrevious: () => void
  onComplete: () => void
  children: React.ReactNode
}

const clearStoredProgress = () => {
  try {
    const removable: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key) continue
      if (key === 'onboarding_progress' || key.startsWith('onboarding_progress:')) {
        removable.push(key)
      }
    }
    removable.forEach(key => window.localStorage.removeItem(key))
  } catch {
    // ignore storage errors
  }
}

export function OnboardingModal({
  title,
  description,
  progress,
  isFirstStep,
  isLastStep,
  loading,
  onNext,
  onPrevious,
  onComplete,
  children
}: OnboardingModalProps) {
  const t = useTranslations('onboarding')

  const performCancellation = useCallback(() => {
    clearStoredProgress()

    try {
      toast.success(t('actions.cancelled'))
    } catch {
      // ignore toast errors
    }

    window.location.href = '/setup/cancel'
  }, [t])

  const requestCancellation = useCallback(() => {
    const title = t('actions.cancelConfirmTitle')
    const message = `${title}\n\n${t('actions.cancelConfirmDescription')}`
    const confirmed = window.confirm(message)
    if (!confirmed) {
      return
    }

    performCancellation()
  }, [performCancellation, t])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      requestCancellation()
    }
  }
  const leftButton = isFirstStep ? (
    <Button
      type="button"
      variant="outline"
      onClick={requestCancellation}
      className="w-full sm:w-auto"
    >
      {t('actions.logout')}
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      onClick={onPrevious}
      className="w-full sm:w-auto"
    >
      <ChevronLeft className="h-4 w-4 mr-2" />
      {t('actions.prev')}
    </Button>
  )

  const rightButton = !isLastStep ? (
    <Button
      type="button"
      onClick={onNext}
      className="w-full sm:w-auto"
    >
      {t('actions.next')}
      <ChevronRight className="h-4 w-4 ml-2" />
    </Button>
  ) : (
    <Button
      type="button"
      onClick={onComplete}
      disabled={loading}
      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
    >
      {loading ? t('actions.creating') : t('actions.start')}
      <ChevronRight className="h-4 w-4 ml-2" />
    </Button>
  )

  return (
    <SimpleModal
      open
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      maxWidth="lg"
    >
      <div className="flex min-h-full flex-col gap-6 pb-4">
        <div className="pt-2">
          <Progress value={progress} className="w-full" />
        </div>

        <div className="flex-1">
          {children}
        </div>

        <div className="sticky bottom-0 left-0 right-0 -mx-6 -mb-4 bg-background/95 px-6 pb-4 pt-3 shadow-[0_-8px_20px_-12px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:static sm:mx-0 sm:mb-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:shadow-none sm:backdrop-blur-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {leftButton}
            {rightButton}
          </div>
        </div>
      </div>
    </SimpleModal>
  )
}
