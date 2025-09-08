'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useWorkspace } from '@/contexts/workspace-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormModal } from '@/components/ui/form-modal'
import { FormSection, FormGrid, InputField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/format'
import { 
  Calculator, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  DollarSign,
  Settings,
  RefreshCw,
  Save
} from 'lucide-react'
import { useEquilibrium } from '@/hooks/use-equilibrium'
import { Form } from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AppLayout } from '@/components/layouts/AppLayout'

// Schema for settings
const settingsSchema = z.object({
  workDays: z.number().min(1).max(31),
  variableCostPercentage: z.number().min(0).max(100)
})

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
    default: 'text-blue-600 bg-blue-50',
    success: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    danger: 'text-red-600 bg-red-50'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${variantStyles[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function EquilibriumPage() {
  const t = useTranslations('equilibrium')
  const tNav = useTranslations('navigation')
  const { currentClinic } = useWorkspace()
  
  // Equilibrium management
  const {
    data,
    loading,
    error,
    updateWorkDays,
    updateVariableCostPercentage,
    refreshData,
    saveSettings
  } = useEquilibrium({
    clinicId: currentClinic?.id,
    defaultWorkDays: 20,
    defaultVariableCostPercentage: 35,
    safetyMarginPercentage: 20
  })

  // Modal state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const settingsForm = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      workDays: data.workDays,
      variableCostPercentage: data.variableCostPercentage
    }
  })

  // Handlers
  const handleUpdateSettings = async (formData: z.infer<typeof settingsSchema>) => {
    updateWorkDays(formData.workDays)
    updateVariableCostPercentage(formData.variableCostPercentage)
    
    setSaving(true)
    try {
      await saveSettings()
      setSettingsModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Calculate progress percentage
  const progressPercentage = data.monthlyTargetCents > 0
    ? Math.min(100, (data.currentRevenueCents / data.monthlyTargetCents) * 100)
    : 0

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
                onClick={() => setSettingsModalOpen(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                {tNav('settings')}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('monthly_progress')}</CardTitle>
            <CardDescription>
              {t('current_vs_target')}
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
                <span>{progressPercentage.toFixed(1)}% {t('completed')}</span>
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
                    <p className="font-medium">{data.daysToBreakEven} {t('days')}</p>
                  </div>
                </div>
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
                <span className="font-medium">{data.variableCostPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">{t('contribution_margin')}</span>
                <span className="font-medium text-green-600">
                  {data.contributionMargin}%
                </span>
              </div>
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  {t('contribution_explanation', { margin: data.contributionMargin })}
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
                <span className="font-medium">20%</span>
              </div>
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  {t('safety_explanation')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Modal */}
        <FormModal
          open={settingsModalOpen}
          onOpenChange={setSettingsModalOpen}
          title={t('equilibrium_settings')}
          onSubmit={settingsForm.handleSubmit(handleUpdateSettings)}
          isSubmitting={saving}
          maxWidth="sm"
        >
          <Form {...settingsForm}>
            <FormSection title={t('parameters')}>
              <FormGrid columns={2}>
                <InputField
                  type="number"
                  label={t('work_days')}
                  value={settingsForm.watch('workDays')}
                  onChange={(value) => settingsForm.setValue('workDays', parseInt(value as string))}
                  placeholder="20"
                  min={1}
                  max={31}
                  error={settingsForm.formState.errors.workDays?.message}
                />
                
                <InputField
                  type="number"
                  label={t('variable_cost_percentage')}
                  value={settingsForm.watch('variableCostPercentage')}
                  onChange={(value) => settingsForm.setValue('variableCostPercentage', parseInt(value as string))}
                  placeholder="35"
                  min={0}
                  max={100}
                  error={settingsForm.formState.errors.variableCostPercentage?.message}
                />
              </FormGrid>
            </FormSection>
          </Form>
        </FormModal>
      </div>
    </AppLayout>
  )
}
