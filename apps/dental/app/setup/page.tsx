'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { useWorkspace } from '@/contexts/workspace-context'
import { evaluateRequirements } from '@/lib/requirements'
import { toast } from 'sonner'

type RequirementId =
  | 'depreciation'
  | 'fixed_costs'
  | 'cost_per_min'
  | 'supplies'
  | 'service_recipe'

type StepDefinition = {
  id: RequirementId
  title: string
  caption: string
  description: string
  action: { href: string; label: string }
}

const STEP_IDS: RequirementId[] = [
  'depreciation',
  'fixed_costs',
  'cost_per_min',
  'supplies',
  'service_recipe'
]

const STEP_ROUTES: Record<RequirementId, string> = {
  depreciation: '/assets',
  fixed_costs: '/fixed-costs',
  cost_per_min: '/time',
  supplies: '/supplies',
  service_recipe: '/services'
}

export default function SetupPage() {
  const router = useRouter()
  const { workspace, currentClinic, refreshWorkspaces, setWorkspace } = useWorkspace()
  const t = useTranslations('setupWizard')
  const stepT = useTranslations('setupWizard.steps')

  const steps = useMemo<StepDefinition[]>(
    () =>
      STEP_IDS.map((id) => ({
        id,
        title: stepT(`${id}.title`),
        caption: stepT(`${id}.caption`),
        description: stepT(`${id}.description`),
        action: { href: STEP_ROUTES[id], label: stepT(`${id}.action`) }
      })),
    [stepT]
  )

  const [activeStepId, setActiveStepId] = useState<RequirementId>(steps[0]?.id ?? 'depreciation')
  const [ready, setReady] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [missingState, setMissingState] = useState<Set<RequirementId> | null>(null)

  const requirementIds = useMemo<RequirementId[]>(() => steps.map((step) => step.id), [steps])
  const isStepDone = useCallback(
    (id: RequirementId) => {
      if (!missingState) return false
      return !missingState.has(id)
    },
    [missingState]
  )

  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[0]
  const activeIndex = steps.findIndex((step) => step.id === activeStepId)
  const nextStep = activeIndex >= 0 ? steps[activeIndex + 1] : undefined
  const firstPendingIndex = useMemo(() => steps.findIndex((step) => !isStepDone(step.id)), [steps, isStepDone])
  const maxAccessibleIndex = firstPendingIndex === -1 ? steps.length - 1 : firstPendingIndex
  const canAdvance = isStepDone(activeStepId)

  const completedSteps = useMemo(() => {
    if (!missingState) return 0
    return steps.length - missingState.size
  }, [missingState, steps])
  const progressValue = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0
  const allDone = steps.length > 0 && completedSteps === steps.length

  try { console.log('[setup] missingState', missingState ? Array.from(missingState) : null) } catch {}

  useEffect(() => { try { console.log("[setup] missingState", missingState && Array.from(missingState)) } catch {} }, [missingState])

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

  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshStatus = useCallback(async (): Promise<Set<RequirementId> | null> => {
    if (!clinicId || !mountedRef.current) return null
    setChecking(true)
    try {
      const result = await evaluateRequirements(
        { clinicId, workspaceId: workspace?.id ?? undefined, cacheKeySuffix: Date.now().toString() },
        requirementIds
      )
      const missingSet = new Set(result?.missing || [])

      try {
        console.log('[setup] evaluateRequirements', { clinicId, missing: result?.missing, raw: result })
      } catch {}

      if (!mountedRef.current) return missingSet
      setMissingState(missingSet)
      try { console.log('[setup] status updated missing', Array.from(missingSet)) } catch {}
      return missingSet
    } catch (error) {
      if (mountedRef.current) {
        console.error('Failed to evaluate setup requirements', error)
        toast.error(t('toasts.checkError'))
      }
      return null
    } finally {
      if (mountedRef.current) {
        setChecking(false)
      }
    }
  }, [clinicId, requirementIds, t, workspace?.id])

  useEffect(() => {
    if (!clinicId) {
      setReady(true)
      return
    }

    let isMounted = true
    ;(async () => {
      try {
        await refreshStatus()
      } finally {
        if (isMounted) {
          setReady(true)
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [clinicId, refreshStatus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__LARALIS_REFRESH_SETUP = refreshStatus
    }
    return () => {
      if (typeof window !== 'undefined' && (window as any).__LARALIS_REFRESH_SETUP === refreshStatus) {
        delete (window as any).__LARALIS_REFRESH_SETUP
      }
    }
  }, [refreshStatus])

  const finishSetup = useCallback(async () => {
    if (finishing || !allDone) return

    setFinishing(true)

    try {
      // Obtener workspace ID del contexto o de localStorage/cookies como fallback
      let workspaceId = workspace?.id

      if (!workspaceId) {
        // Intentar obtener de localStorage/cookies
        try {
          const stored = localStorage.getItem('selectedWorkspaceId')
          if (stored) {
            workspaceId = stored
          } else {
            const cookieMatch = document.cookie.match(/(?:^|; )workspaceId=([^;]+)/)
            if (cookieMatch) {
              workspaceId = decodeURIComponent(cookieMatch[1])
            }
          }
        } catch (e) {
          console.error('Error reading workspace ID from storage:', e)
        }

        // Si aún no hay workspace ID, intentar refrescar
        if (!workspaceId) {
          await refreshWorkspaces()
          await new Promise(resolve => setTimeout(resolve, 500))
          workspaceId = workspace?.id
        }
      }

      // Verificar si finalmente tenemos un workspace ID
      if (!workspaceId) {
        toast.error(t('toasts.workspaceMissing'))
        setFinishing(false)
        return
      }

      const fallback = t('toasts.finishError')

      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true })
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload?.message || fallback)
      }

      // Actualizar el workspace en el contexto si existe
      if (workspace) {
        try {
          setWorkspace({ ...workspace, onboarding_completed: true })
        } catch {}
      }

      await refreshWorkspaces()
      router.replace('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : fallback
      toast.error(message || fallback)
      setFinishing(false)
    }
  }, [allDone, finishing, refreshWorkspaces, router, setWorkspace, t, workspace])

  const handleNextStep = useCallback(async () => {
    if (!nextStep) return
    if (!canAdvance) {
      const missing = await refreshStatus()
      if (!missing || missing.has(activeStepId)) {
        toast.info(t('navigation.locked'))
        return
      }
    }
    setActiveStepId(nextStep.id)
  }, [nextStep, canAdvance, refreshStatus, activeStepId, t])

  useEffect(() => {
    if (!ready) return
    if (!missingState) return
    const firstPending = steps.find((step) => missingState.has(step.id))
    if (firstPending && firstPending.id !== activeStepId) {
      setActiveStepId(firstPending.id)
    }
  }, [ready, missingState, steps, activeStepId])

  if (!ready) {
    return <Loading fullscreen message={t('loading.message')} subtitle={t('loading.subtitle')} />
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 pb-32 lg:p-8 lg:pb-8">
        <PageHeader title={t('header.title')} subtitle={t('header.subtitle')} />

        <Card className="space-y-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <Badge variant={allDone ? 'default' : 'secondary'} className="w-fit">
                {allDone ? t('progress.badge.complete') : t('progress.badge.incomplete')}
              </Badge>
              <h2 className="text-2xl font-semibold">
                {t('progress.count', { completed: completedSteps, total: steps.length })}
              </h2>
              <p className="text-sm text-muted-foreground">{t('progress.description')}</p>
            </div>
            <div className="md:w-64">
              <Progress value={progressValue} className="h-2" />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('progress.label')}</span>
                <span>{t('progress.percent', { value: progressValue })}</span>
              </div>
              <div className="mt-3 flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshStatus()}
                  disabled={checking}
                >
                  {checking ? t('progress.refreshing') : t('progress.refresh')}
                </Button>
              </div>
            </div>
          </div>
          <div className="hidden border-t pt-4 md:block">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {steps.map((step, index) => {
                const done = isStepDone(step.id)
                const isActive = step.id === activeStepId
                const locked = firstPendingIndex !== -1 && index > maxAccessibleIndex
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        toast.info(t('navigation.locked'))
                        return
                      }
                      setActiveStepId(step.id)
                    }}
                    disabled={locked}
                    className={`min-w-[190px] rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      locked
                        ? 'cursor-not-allowed opacity-50'
                        : isActive
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : done
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {t('stepper.step', { index: index + 1 })}
                    </span>
                    <p className="text-sm font-semibold leading-tight">{step.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{step.caption}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
            <Card className="space-y-6 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {t('currentStep.label', { index: activeIndex + 1, total: steps.length })}
                  </span>
                  <h2 className="text-xl font-semibold md:text-2xl">{activeStep?.title}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {activeStep?.description}
                  </p>
                </div>
                <Badge variant={isStepDone(activeStepId) ? 'default' : 'secondary'}>
                  {isStepDone(activeStepId) ? t('currentStep.validated') : t('currentStep.inProgress')}
                </Badge>
              </div>

              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-primary">
                  {t('primaryPanel.title')}
                </p>
                <h4 className="mt-2 text-lg font-semibold leading-tight">{activeStep?.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{activeStep?.caption}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    onClick={() => {
                      try { if (typeof window !== 'undefined') sessionStorage.setItem('return_to_setup', '1') } catch {}
                      const href = activeStep?.action.href ?? '#'
                      const parts = href.split('?')[0]
                      const params = new URLSearchParams(href.includes('?') ? href.split('?')[1] : '')
                      params.set('from', 'setup')
                      if (currentClinic?.id) params.set('clinicId', currentClinic.id)
                      const target = `${parts}?${params.toString()}`
                      router.push(target)
                    }}
                    className="flex-1 min-w-[200px] justify-center"
                  >
                    {activeStep?.action.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={refreshStatus} disabled={checking}>
                    <RotateCw className="mr-2 h-4 w-4" />
                    {checking ? t('primaryPanel.refreshing') : t('primaryPanel.refresh')}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={nextStep ? handleNextStep : finishSetup}
                  disabled={finishing || (!nextStep && !allDone)}
                >
                  {nextStep
                    ? t('navigation.nextShort')
                    : allDone
                      ? finishing
                        ? t('navigation.completing')
                        : t('navigation.completeReady')
                      : t('navigation.completeDisabled')}
                </Button>
              </div>
            </Card>
        </div>
      </div>
    </AppLayout>
  )
}
