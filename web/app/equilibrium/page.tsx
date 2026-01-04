'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useWorkspace } from '@/contexts/workspace-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Settings, RefreshCw } from 'lucide-react'
import { useEquilibrium } from '@/hooks/use-equilibrium'
import { usePermissions } from '@/hooks/use-permissions'
import { AppLayout } from '@/components/layouts/AppLayout'
import { centsToPesos } from '@/lib/money'
import { toast } from 'sonner'
import { PermissionGate } from '@/components/auth/PermissionGate'
import {
  FinancialBase,
  ContributionAnalysis,
  MonthlyGoalSection,
  ProgressSection,
  SimulationControls,
} from './components'

export default function EquilibriumPage() {
  const t = useTranslations('equilibrium')
  const { currentClinic } = useWorkspace()
  const router = useRouter()
  const { can } = usePermissions()
  const canView = can('break_even.view')

  const roundPercent = (value: number) =>
    Number.isFinite(value) ? Number(Number(value).toFixed(1)) : 0

  const {
    data,
    loading,
    simulate,
    resetSimulation,
    refreshData,
  } = useEquilibrium({
    clinicId: canView ? currentClinic?.id : undefined,
    defaultWorkDays: 20,
    defaultVariableCostPercentage: 35,
    safetyMarginPercentage: 20,
  })

  const [simulationValues, setSimulationValues] = useState<{
    workDays: number
    variableCostPercentage: number
    safetyMarginPercentage: number
    manualMonthlyTarget: number | ''
  }>(() => ({
    workDays: data.workDays,
    variableCostPercentage: roundPercent(data.variableCostPercentage),
    safetyMarginPercentage: roundPercent(data.customSafetyMarginPercentage),
    manualMonthlyTarget:
      data.manualMonthlyTargetCents > 0
        ? Number(centsToPesos(data.manualMonthlyTargetCents).toFixed(2))
        : '',
  }))

  useEffect(() => {
    setSimulationValues({
      workDays: data.workDays,
      variableCostPercentage: roundPercent(data.variableCostPercentage),
      safetyMarginPercentage: roundPercent(data.customSafetyMarginPercentage),
      manualMonthlyTarget:
        data.manualMonthlyTargetCents > 0
          ? Number(centsToPesos(data.manualMonthlyTargetCents).toFixed(2))
          : '',
    })
  }, [
    data.workDays,
    data.variableCostPercentage,
    data.customSafetyMarginPercentage,
    data.manualMonthlyTargetCents,
  ])

  const handleSimulationFieldChange =
    (field: keyof typeof simulationValues) =>
    (value: number | string) => {
      setSimulationValues(prev => ({
        ...prev,
        [field]: value === '' ? '' : Number(value),
      }))
    }

  const handleApplySimulation = () => {
    const workDays = Number(simulationValues.workDays)
    const variableCost = Number(simulationValues.variableCostPercentage)
    const safetyMargin = Number(simulationValues.safetyMarginPercentage)

    if (!Number.isFinite(workDays) || workDays < 1 || workDays > 31) {
      toast.error(t('validation.workDays'))
      return
    }
    if (!Number.isFinite(variableCost) || variableCost < 0 || variableCost > 100) {
      toast.error(t('validation.variableCost'))
      return
    }
    if (!Number.isFinite(safetyMargin) || safetyMargin < 0 || safetyMargin > 200) {
      toast.error(t('validation.safetyMargin'))
      return
    }

    const manual =
      simulationValues.manualMonthlyTarget === ''
        ? null
        : Number(simulationValues.manualMonthlyTarget)

    if (manual !== null && (!Number.isFinite(manual) || manual < 0)) {
      toast.error(t('validation.manualTarget'))
      return
    }

    simulate({
      workDays,
      variableCostPercentage: variableCost,
      safetyMarginPercentage: safetyMargin,
      manualMonthlyTargetPesos: manual,
    })
  }

  const handleResetSimulation = () => {
    resetSimulation()
    setSimulationValues({
      workDays: data.baseWorkDays,
      variableCostPercentage: roundPercent(data.autoVariableCostPercentage),
      safetyMarginPercentage: roundPercent(data.baseSafetyMarginPercentage),
      manualMonthlyTarget: '',
    })
  }

  if (loading) {
    return (
      <AppLayout>
        <PermissionGate permission="break_even.view" fallbackType="message">
          <div className="p-4 lg:p-8 max-w-5xl mx-auto">
            <PageHeader title={t('title')} subtitle={t('subtitle')} />
            <div className="space-y-6 mt-6">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader className="space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </PermissionGate>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <PermissionGate permission="break_even.view" fallbackType="message">
        <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push('/time')}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t('go_to_time_settings')}
                </Button>
                <Button variant="outline" size="sm" onClick={refreshData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('refresh')}
                </Button>
              </div>
            }
          />

          {/* Section 1: Financial Base */}
          <FinancialBase
            fixedCostsCents={data.fixedCostsCents}
            breakEvenRevenueCents={data.breakEvenRevenueCents}
          />

          {/* Section 2: Contribution Analysis */}
          <ContributionAnalysis
            variableCostPercentage={data.variableCostPercentage}
            contributionMargin={data.contributionMargin}
            variableCostSource={data.variableCostSource}
            autoVariableCostPercentage={data.autoVariableCostPercentage}
            autoVariableCostSampleSize={data.autoVariableCostSampleSize}
            autoVariableCostPeriodDays={data.autoVariableCostPeriod?.days ?? 90}
          />

          {/* Section 3: Monthly Goal */}
          <MonthlyGoalSection
            monthlyTargetCents={data.monthlyTargetCents}
            dailyTargetCents={data.dailyTargetCents}
            workDays={data.workDays}
            safetyMarginPercentage={data.safetyMarginPercentage}
            safetyMarginCents={data.safetyMarginCents}
            manualMonthlyTargetCents={data.manualMonthlyTargetCents}
            customSafetyMarginPercentage={data.customSafetyMarginPercentage}
          />

          {/* Section 4: Current Progress */}
          <ProgressSection
            currentRevenueCents={data.currentRevenueCents}
            monthlyTargetCents={data.monthlyTargetCents}
            revenueGapCents={data.revenueGapCents}
            progressPercentage={data.progressPercentage || 0}
            daysToBreakEven={data.daysToBreakEven}
            remainingWorkingDays={data.remainingWorkingDays}
          />

          {/* Section 5: Simulation (Collapsible) */}
          <SimulationControls
            values={simulationValues}
            baseWorkDays={data.baseWorkDays}
            autoVariableCostPercentage={data.autoVariableCostPercentage}
            autoVariableCostSampleSize={data.autoVariableCostSampleSize}
            autoVariableCostPeriodDays={data.autoVariableCostPeriod?.days ?? 90}
            variableCostSource={data.variableCostSource}
            onFieldChange={handleSimulationFieldChange}
            onApply={handleApplySimulation}
            onReset={handleResetSimulation}
          />
        </div>
      </PermissionGate>
    </AppLayout>
  )
}
