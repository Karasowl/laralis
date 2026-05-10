'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingEvents, type OnboardingEventDetail } from '@/lib/events'
import { track } from '@/lib/analytics'

export function OnboardingListeners() {
  const router = useRouter()

  useEffect(() => {
    const onImporter = (e: Event) => {
      const detail = (e as CustomEvent<OnboardingEventDetail>).detail
      try { sessionStorage.setItem('auto_open_supplies_importer', '1') } catch {}
      router.push('/supplies')
    }

    const onRecipeWizard = (e: Event) => {
      const detail = (e as CustomEvent<OnboardingEventDetail>).detail
      if (detail?.serviceId) {
        try { sessionStorage.setItem('auto_open_recipe_wizard_serviceId', detail.serviceId) } catch {}
      }
      router.push('/services')
    }

    window.addEventListener(OnboardingEvents.OpenSuppliesImporter, onImporter as any)
    window.addEventListener(OnboardingEvents.OpenRecipeWizard, onRecipeWizard as any)
    return () => {
      window.removeEventListener(OnboardingEvents.OpenSuppliesImporter, onImporter as any)
      window.removeEventListener(OnboardingEvents.OpenRecipeWizard, onRecipeWizard as any)
    }
  }, [router])

  return null
}
