'use client'

import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { ChecklistStep } from '@/components/onboarding/ChecklistStep'

export default function SetupPage() {
  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Configuración inicial"
          subtitle="Completa estos pasos para habilitar tratamientos con precios correctos"
        />

        <ChecklistStep
          items={[
            { id: 'depreciation', label: 'Depreciación (activos/equipos)', href: '/assets' },
            { id: 'fixed_costs', label: 'Costos fijos mensuales', href: '/fixed-costs' },
            { id: 'cost_per_min', label: 'Configuración de tiempo / Costo por minuto', href: '/time' }
          ]}
        />

        <ChecklistStep
          items={[
            { id: 'supplies', label: 'Insumos (presentación y porciones)', href: '/supplies' },
            { id: 'service_recipe', label: 'Recetas por servicio', href: '/services' },
            { id: 'tariffs', label: 'Tarifas y redondeo', href: '/tariffs' }
          ]}
        />
      </div>
    </AppLayout>
  )
}


