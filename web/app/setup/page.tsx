'use client'

import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { ChecklistStep } from '@/components/onboarding/ChecklistStep'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '@/contexts/workspace-context'
import { useRouter } from 'next/navigation'
import { evaluateRequirements } from '@/lib/requirements'
import { Loading } from '@/components/ui/loading'
import { toast } from 'sonner'

export default function SetupPage() {
  const router = useRouter()
  const { workspace, currentClinic, refreshWorkspaces, setWorkspace } = useWorkspace() as any
  const [allOk, setAllOk] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const clinicId = useMemo(() => {
    if (currentClinic?.id) return currentClinic.id
    try {
      if (typeof document !== 'undefined') {
        const cookieMatch = document.cookie.match(/(?:^|; )clinicId=([^;]+)/)
        if (cookieMatch) return decodeURIComponent(cookieMatch[1])
      }
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('selectedClinicId')
        if (stored) return stored
      }
    } catch {}
    return undefined
  }, [currentClinic?.id])

  useEffect(() => {
    if (!clinicId) {
      setReady(true)
      setAllOk(false)
      return
    }

    let mounted = true
    ;(async () => {
      try {
        const res = await evaluateRequirements(
          { clinicId: clinicId as any },
          ['depreciation', 'fixed_costs', 'cost_per_min', 'supplies', 'service_recipe', 'tariffs'] as any
        )
        if (mounted) {
          setAllOk((res.missing || []).length === 0)
        }
      } catch {
        if (mounted) setAllOk(false)
      } finally {
        if (mounted) setReady(true)
      }
    })()

    return () => {
      mounted = false
    }
  }, [clinicId])

  const finishSetup = async () => {
    if (finishing) return

    if (!workspace?.id) {
      toast.error('No se encontró el espacio de trabajo.')
      return
    }

    setFinishing(true)
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(payload?.message || 'No se pudo finalizar la configuración')
      }

      // Optimistic: marcar como completado en contexto y luego refrescar
      try { setWorkspace && setWorkspace({ ...(workspace as any), onboarding_completed: true }) } catch {}
      await refreshWorkspaces()
      router.replace('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo finalizar la configuración'
      toast.error(message)
      setFinishing(false)
    }
  }

  if (!ready) {
    return <Loading fullscreen message="Cargando configuración..." subtitle="Un momento, estamos preparando todo" />
  }

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

        <Card className="p-6 space-y-3">
          <h3 className="text-xl font-semibold">¿Qué sigue?</h3>
          <p className="text-sm text-muted-foreground">
            Ya configuraste la base financiera y tu catálogo. A partir de ahora el día a día es simple:
          </p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Los pacientes son únicos en tu clínica.</li>
            <li>Un paciente puede tener múltiples tratamientos.</li>
            <li>Cada tratamiento usa un servicio (con su tiempo, receta y tarifa) para calcular precio y márgenes.</li>
          </ul>
          <div className="pt-2 flex flex-wrap gap-2">
            <Button onClick={() => router.push('/patients')} variant="outline">Crear paciente</Button>
            <Button onClick={() => router.push('/treatments')} variant="outline">Crear tratamiento</Button>
            <Button onClick={finishSetup} disabled={allOk === false || finishing}>
              {allOk ? (finishing ? 'Finalizando...' : 'Finalizar configuración e ir al Dashboard') : 'Completa los pasos para finalizar'}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
