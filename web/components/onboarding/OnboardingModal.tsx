'use client'

import { SimpleModal } from '@/components/ui/form-modal'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

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
  const router = useRouter()
  const supabase = createClient()

  const handleCancel = async () => {
    try {
      await supabase.auth.signOut()
      toast.success(t('actions.cancelled'))
      router.push('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Error al cerrar sesión')
    }
  }

  return (
    <SimpleModal
      open={true}
      onOpenChange={() => {}}
      title={title}
      description={description}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <Progress value={progress} className="w-full" />
        
        {children}
        
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={isFirstStep}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {t('actions.prev')}
          </Button>

          {!isLastStep ? (
            <Button onClick={onNext}>
              {t('actions.next')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
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