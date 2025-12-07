'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect, useMemo } from 'react'
import { useWorkspace } from '@/contexts/workspace-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormGrid, InputField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import {
  Calculator,
  TrendingUp,
  AlertTriangle,
  Target,
  DollarSign,
  RefreshCw,
  Info,
  CheckCircle
} from 'lucide-react'
import { useEquilibrium } from '@/hooks/use-equilibrium'
import { AppLayout } from '@/components/layouts/AppLayout'
import { centsToPesos } from '@/lib/money'
import { toast } from 'sonner'

// Component for metric cards
function MetricCard({
  icon: Icon,
  title,
  value,
  description,
  variant = 'default'
}: {
  icon: any
  title: string
  value: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const variantStyles = {
    default: 'text-primary bg-primary/10',
    success: 'text-green-600 bg-green-50 dark:bg-green-950/30',
    warning: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
    danger: 'text-destructive bg-destructive/10'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
        <div className={`p-1.5 sm:p-2 rounded-lg ${variantStyles[variant]}`}>
          <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-lg sm:text-xl lg:text-2xl font-bold tabular-nums">{value}</div>
        {description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function EquilibriumPage() {
  const t = useTranslations('equilibrium')
  const { currentClinic } = useWorkspace()
  const router = useRouter()

    const formatPercent = (value: number) =>
      `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`
    
    const roundPercent = (value: number) =>
      Number.isFinite(value) ? Number(Number(value).toFixed(1)) : 0
  
    // Equilibrium management
    const {
    data,
    loading,
    simulate,
    resetSimulation,
    refreshData
  } = useEquilibrium({
    clinicId: currentClinic?.id,
    defaultWorkDays: 20,
    defaultVariableCostPercentage: 35,
    safetyMarginPercentage: 20
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
        : ''
  }))

  useEffect(() => {
    setSimulationValues({
      workDays: data.workDays,
      variableCostPercentage: roundPercent(data.variableCostPercentage),
      safetyMarginPercentage: roundPercent(data.customSafetyMarginPercentage),
      manualMonthlyTarget:
        data.manualMonthlyTargetCents > 0
          ? Number(centsToPesos(data.manualMonthlyTargetCents).toFixed(2))
          : ''
    })
  }, [
    data.workDays,
    data.variableCostPercentage,
    data.customSafetyMarginPercentage,
    data.manualMonthlyTargetCents
  ])

  const handleSimulationFieldChange =
    (field: keyof typeof simulationValues) =>
    (value: number | string) => {
      setSimulationValues(prev => ({
        ...prev,
        [field]: value === '' ? '' : Number(value)
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
      manualMonthlyTargetPesos: manual
    })
  }

  const handleResetSimulation = () => {
    resetSimulation()
    setSimulationValues({
      workDays: data.baseWorkDays,
      variableCostPercentage: roundPercent(data.autoVariableCostPercentage),
      safetyMarginPercentage: roundPercent(data.baseSafetyMarginPercentage),
      manualMonthlyTarget: ''
    })
  }

  const progressPercentage = data.progressPercentage || 0
  const isGoalReached = data.revenueGapCents <= 0

  const summaryLines = useMemo(
    () => [
      t('summary.line1', {
        breakEven: formatCurrency(data.breakEvenRevenueCents)
      }),
      t('summary.line2', {
        safetyMargin: formatPercent(data.safetyMarginPercentage),
        monthlyTarget: formatCurrency(data.monthlyTargetCents),
        dailyTarget: formatCurrency(data.dailyTargetCents),
        workDays: data.workDays
      }),
      isGoalReached
        ? t('summary.line3_goalReached', {
            monthlyTarget: formatCurrency(data.monthlyTargetCents)
          })
        : t('summary.line3', {
            currentRevenue: formatCurrency(data.currentRevenueCents),
            revenueGap: formatCurrency(data.revenueGapCents),
            days: data.daysToBreakEven
          })
    ],
    [
      t,
      data.breakEvenRevenueCents,
      data.safetyMarginPercentage,
      data.monthlyTargetCents,
      data.dailyTargetCents,
      data.workDays,
      data.currentRevenueCents,
      data.revenueGapCents,
      data.daysToBreakEven,
      isGoalReached
    ]
  )

  // Determine status variant
  const getStatusVariant = () => {
    if (progressPercentage >= 100) return 'success'
    if (progressPercentage >= 80) return 'warning'
    return 'danger'
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-6 bg-muted animate-pulse rounded" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/time')}
              >
                <Info className="h-4 w-4 mr-2" />
                {t('go_to_time_settings')}
              </Button>
              <Button
                variant="outline"
                onClick={refreshData}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('refresh')}
              </Button>
            </div>
          }
        />

        {/* Key Metrics */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={DollarSign}
            title={t('fixed_costs')}
            value={formatCurrency(data.fixedCostsCents)}
            description={t('monthly_fixed')}
          />
          
          <MetricCard
            icon={Target}
            title={t('break_even')}
            value={formatCurrency(data.breakEvenRevenueCents)}
            description={t('minimum_revenue')}
            variant="warning"
          />
          
          <MetricCard
            icon={TrendingUp}
            title={t('monthly_target')}
            value={formatCurrency(data.monthlyTargetCents)}
            description={t('with_safety_margin')}
            variant="success"
          />
          
          <MetricCard
            icon={Calculator}
            title={t('daily_target')}
            value={formatCurrency(data.dailyTargetCents)}
            description={`${data.workDays} ${t('work_days')}`}
          />
        </div>

        {/* Plain language summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t('summary.title')}</CardTitle>
            <CardDescription>{t('summary.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {summaryLines.map((line, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 flex-none rounded-full bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Simulation Controls */}
        <Card>
          <CardHeader>
            <CardTitle>{t('simulation.title')}</CardTitle>
            <CardDescription>{t('simulation.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormGrid columns={2}>
              <InputField
                type="number"
                label={t('simulation.work_days_label')}
                value={simulationValues.workDays}
                onChange={handleSimulationFieldChange('workDays')}
                min={1}
                max={31}
                helperText={t('simulation.work_days_hint', { value: data.baseWorkDays })}
              />
              <InputField
                type="number"
                label={t('simulation.variable_cost_label')}
                value={simulationValues.variableCostPercentage}
                onChange={handleSimulationFieldChange('variableCostPercentage')}
                min={0}
                max={100}
                step="0.1"
                helperText={
                  data.variableCostSource === 'calculated'
                    ? t('simulation.variable_cost_calculated', {
                        value: formatPercent(data.autoVariableCostPercentage),
                        sample: data.autoVariableCostSampleSize,
                        days: data.autoVariableCostPeriod?.days ?? 90
                      })
                    : t('simulation.variable_cost_fallback', {
                        value: formatPercent(data.autoVariableCostPercentage)
                      })
                }
              />
              <InputField
                type="number"
                label={t('simulation.safety_margin_label')}
                value={simulationValues.safetyMarginPercentage}
                onChange={handleSimulationFieldChange('safetyMarginPercentage')}
                min={0}
                max={200}
                step="0.5"
                helperText={t('simulation.safety_margin_hint')}
              />
              <InputField
                type="number"
                label={t('simulation.manual_target_label')}
                value={simulationValues.manualMonthlyTarget}
                onChange={handleSimulationFieldChange('manualMonthlyTarget')}
                min={0}
                step="0.01"
                placeholder="—"
                helperText={t('simulation.manual_target_hint')}
              />
            </FormGrid>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleApplySimulation}>
                {t('simulation.apply')}
              </Button>
              <Button variant="outline" onClick={handleResetSimulation}>
                {t('simulation.reset')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('monthly_progress')}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {t('current_vs_target')}
              <Badge variant={isGoalReached ? 'success' : 'outline'}>
                {isGoalReached
                  ? t('summary.goalBadge')
                  : t('summary.gapBadge', { days: data.daysToBreakEven })}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('current_revenue')}</span>
                <span className="font-medium">
                  {formatCurrency(data.currentRevenueCents)}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formatPercent(progressPercentage)} {t('completed')}</span>
                <span>{t('target')}: {formatCurrency(data.monthlyTargetCents)}</span>
              </div>
            </div>

            {data.revenueGapCents > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium">{t('revenue_gap')}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('amount_needed')}:</span>
                    <p className="font-medium">{formatCurrency(data.revenueGapCents)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('days_to_achieve')}:</span>
                    <p className="font-medium">{t('summary.daysLabel', { days: data.daysToBreakEven })}</p>
                  </div>
                </div>
              </div>
            )}
            {isGoalReached && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/30">
                <CheckCircle className="h-4 w-4" />
                <span>{t('summary.goalMessage')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('contribution_analysis')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">{t('variable_costs')}</span>
                <span className="font-medium">
                  {formatPercent(data.variableCostPercentage)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('contribution_margin')}</span>
                <span className="font-medium text-green-600">
                  {formatPercent(data.contributionMargin)}
                </span>
              </div>
              <div className="pt-3 border-t space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('contribution_explanation', {
                    margin: formatPercent(data.contributionMargin)
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.variableCostSource === 'calculated'
                    ? t('simulation.variable_cost_calculated_short', {
                        value: formatPercent(data.autoVariableCostPercentage),
                        sample: data.autoVariableCostSampleSize,
                        days: data.autoVariableCostPeriod?.days ?? 90
                      })
                    : t('simulation.variable_cost_fallback_short', {
                        value: formatPercent(data.autoVariableCostPercentage)
                      })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('safety_margin')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">{t('safety_amount')}</span>
                <span className="font-medium">
                  {formatCurrency(data.safetyMarginCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('safety_percentage')}</span>
                <span className="font-medium">
                  {formatPercent(data.safetyMarginPercentage)}
                </span>
              </div>
              <div className="pt-3 border-t space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('safety_explanation')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.manualMonthlyTargetCents > 0
                    ? t('simulation.manual_target_active_hint', {
                        amount: formatCurrency(data.manualMonthlyTargetCents)
                      })
                    : t('simulation.safety_margin_custom_hint', {
                        percentage: formatPercent(data.customSafetyMarginPercentage)
                      })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
