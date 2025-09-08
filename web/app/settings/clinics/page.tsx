'use client'

import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building } from 'lucide-react'

export default function ClinicsPage() {
  const t = useTranslations()
  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.clinics.title')}
          subtitle={t('settings.clinics.description')}
        />
        <Card className="p-12 text-center">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t('settings.clinics.movedTitle', 'La gestión de clínicas se ha movido')}
          </h3>
          <p className="text-gray-500 mb-6">
            {t('settings.clinics.movedDesc', 'Ahora administras las clínicas dentro de cada Espacio de Trabajo, siguiendo el mismo patrón visual de Marketing (Plataformas → Campañas).')}
          </p>
          <Button onClick={() => (window.location.href = '/settings/workspaces')}>
            {t('settings.clinics.goToWorkspaces', 'Ir a Espacios de Trabajo')}
          </Button>
        </Card>
      </div>
    </AppLayout>
  )
}

