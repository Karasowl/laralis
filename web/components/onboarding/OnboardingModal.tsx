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

  return (
    <SimpleModal
      open
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <Progress value={progress} className="w-full" />

        {children}

        <div className="flex justify-between pt-4">
          {isFirstStep ? (
            <Button
              type="button"
              variant="outline"
              onClick={requestCancellation}
            >
              {t('actions.logout')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              {t('actions.prev')}
            </Button>
          )}

          {!isLastStep ? (
            <Button type="button" onClick={onNext}>
              {t('actions.next')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onComplete}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? t('actions.creating') : t('actions.start')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </SimpleModal>
  )
}
