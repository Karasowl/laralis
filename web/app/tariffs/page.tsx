'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'

/**
 * DEPRECATED: Tariffs page
 *
 * This page has been deprecated as of 2025-11-17.
 * Discount functionality has been migrated to the Services module.
 *
 * Migration: 47_add_discounts_to_services.sql
 *
 * Users are automatically redirected to /services after 5 seconds.
 */
export default function TariffsDeprecatedPage() {
  const router = useRouter()
  const t = useTranslations('tariffs')
  const tCommon = useTranslations('common')

  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      router.push('/services')
    }, 5000)

    return () => clearTimeout(timer)
  }, [router])

  const handleRedirectNow = () => {
    router.push('/services')
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="p-8 md:p-12 max-w-2xl w-full">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
                <AlertTriangle className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-center mb-4">
              {t('deprecated_title') || 'Módulo de Tarifas Deprecado'}
            </h1>

            {/* Description */}
            <div className="space-y-4 text-muted-foreground mb-8">
              <p className="text-center">
                {t('deprecated_description') ||
                  'La funcionalidad de tarifas ha sido migrada al módulo de Servicios para simplificar la gestión de precios.'}
              </p>

              {/* Info box */}
              <div className="bg-primary/10 dark:bg-primary/20/30 border border-primary/30 dark:border-primary/40/40 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-primary dark:text-primary/80 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-primary/95 dark:text-primary">
                      {t('whats_new') || '¿Qué ha cambiado?'}
                    </p>
                    <ul className="space-y-1 text-primary dark:text-primary/90">
                      <li>• {t('change_1') || 'Los descuentos ahora se configuran directamente en cada servicio'}</li>
                      <li>• {t('change_2') || 'El precio final se calcula automáticamente con el descuento aplicado'}</li>
                      <li>• {t('change_3') || 'Mayor simplicidad: un solo lugar para gestionar precios'}</li>
                      <li>• {t('change_4') || 'Todos tus datos históricos están preservados'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleRedirectNow}
                size="lg"
                className="w-full sm:w-auto"
              >
                {t('go_to_services') || 'Ir a Servicios'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Auto-redirect notice */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              {t('auto_redirect') || 'Serás redirigido automáticamente en 5 segundos...'}
            </p>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
