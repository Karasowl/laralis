'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useWorkspace } from '@/contexts/workspace-context'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormModal } from '@/components/ui/form-modal'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import { 
  Clock, 
  Calendar,
  Settings,
  RefreshCw,
  TrendingUp
} from 'lucide-react'
import { useTimeSettings } from '@/hooks/use-time-settings'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeMetricCard } from './components/TimeMetricCard'
import { CostBreakdown } from './components/CostBreakdown'
import { TimeSettingsForm } from './components/TimeSettingsForm'

// Schema for time settings
const timeSettingsSchema = z.object({
  work_days: z.number().min(1).max(31),
  hours_per_day: z.number().min(1).max(24),
  real_pct: z.number().min(1).max(100)
})

export default function TimeSettingsPage() {
  const t = useTranslations('time')
  const { currentClinic } = useWorkspace()
  
  // Time settings management
  const {
    settings,
    calculations,
    fixedCosts,
    assetsDepreciation,
    totalFixedCosts,
    loading,
    error,
    updateSettings,
    saveSettings,
    refreshData
  } = useTimeSettings({
    clinicId: currentClinic?.id
  })

  // Modal state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const settingsForm = useForm({
    resolver: zodResolver(timeSettingsSchema),
    defaultValues: settings
  })

  // Handlers
  const handleUpdateSettings = async (data: z.infer<typeof timeSettingsSchema>) => {
    updateSettings(data)
    
    setSaving(true)
    const success = await saveSettings()
    setSaving(false)
    
    if (success) {
      setSettingsModalOpen(false)
      settingsForm.reset(data)
    }
  }

  const handleOpenModal = () => {
    settingsForm.reset(settings)
    setSettingsModalOpen(true)
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
              <Skeleton key={i} className="h-32" />
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
                onClick={handleOpenModal}
              >
                <Settings className="h-4 w-4 mr-2" />
                {t('adjust_settings')}
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

        {/* Current Settings */}
        <div className="grid gap-4 md:grid-cols-3">
          <TimeMetricCard
            icon={Calendar}
            title={t('work_days')}
            value={settings.work_days}
            subtitle={t('per_month')}
            variant="primary"
          />
          
          <TimeMetricCard
            icon={Clock}
            title={t('hours_per_day')}
            value={settings.hours_per_day}
            subtitle={t('scheduled')}
            variant="primary"
          />
          
          <TimeMetricCard
            icon={TrendingUp}
            title={t('productivity')}
            value={`${settings.real_pct}%`}
            subtitle={t('real_time')}
            variant="success"
          />
        </div>

        {/* Time Calculations */}
        <Card>
          <CardHeader>
            <CardTitle>{t('time_calculations')}</CardTitle>
            <CardDescription>{t('based_on_settings')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('hours_month')}</p>
                <p className="text-2xl font-bold">{calculations.hoursMonth}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('hours_year')}</p>
                <p className="text-2xl font-bold">{calculations.hoursYear}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('productive_hours_month')}</p>
                <p className="text-2xl font-bold text-green-600">{calculations.realHoursMonth}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('productive_hours_year')}</p>
                <p className="text-2xl font-bold text-green-600">{calculations.realHoursYear}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Analysis */}
        <div className="grid gap-4 md:grid-cols-2">
          <CostBreakdown
            costs={fixedCosts}
            depreciation={assetsDepreciation}
            total={totalFixedCosts}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t('cost_per_time')}</CardTitle>
              <CardDescription>{t('fixed_cost_allocation')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('cost_per_minute')}</p>
                    <p className="text-xs text-muted-foreground">{t('productive_minute')}</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(calculations.fixedCostPerMinuteCents)}
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t('cost_per_hour')}</p>
                    <p className="text-xs text-muted-foreground">{t('productive_hour')}</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(calculations.fixedCostPerHourCents)}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground">
                  {t('cost_explanation')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Minutes Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t('minutes_summary')}</CardTitle>
            <CardDescription>{t('total_productive_time')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('minutes_month')}</p>
                <p className="text-xl font-semibold">{calculations.minutesMonth.toLocaleString()}</p>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('minutes_year')}</p>
                <p className="text-xl font-semibold">{calculations.minutesYear.toLocaleString()}</p>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('productive_minutes_month')}</p>
                <p className="text-xl font-semibold text-green-600">
                  {calculations.realMinutesMonth.toLocaleString()}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t('productive_minutes_year')}</p>
                <p className="text-xl font-semibold text-green-600">
                  {calculations.realMinutesYear.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Modal */}
        <FormModal
          open={settingsModalOpen}
          onOpenChange={setSettingsModalOpen}
          title={t('time_settings')}
          onSubmit={settingsForm.handleSubmit(handleUpdateSettings)}
          isSubmitting={saving}
          maxWidth="sm"
        >
          <TimeSettingsForm form={settingsForm} />
        </FormModal>
      </div>
    </AppLayout>
  )
}