'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/FormField';
import { calculateTimeCosts } from '@/lib/calc/tiempo';
import { formatCurrency } from '@/lib/format';
import { zSettingsTimeForm } from '@/lib/zod';
import { useWorkspace } from '@/contexts/workspace-context';
import type { SettingsTime, FixedCost } from '@/lib/types';
import { useState, useEffect } from 'react';

type TimeSettingsForm = {
  work_days: number;
  hours_per_day: number;
  real_pct: number;
};

export default function TimeSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [results, setResults] = useState<any>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [assetsMonthlyDepCents, setAssetsMonthlyDepCents] = useState(0);
  const [totalFixedCents, setTotalFixedCents] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TimeSettingsForm>({
    resolver: zodResolver(zSettingsTimeForm),
    defaultValues: {
      work_days: 20,
      hours_per_day: 7,
      real_pct: 80, // Cambiado a porcentaje entero
    },
  });

  // Watch specific values instead of the entire form
  const workDays = watch('work_days');
  const hoursPerDay = watch('hours_per_day');
  const realPct = watch('real_pct');

  // Load existing data on mount
  // ✅ Recargar cuando cambie la clínica
  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id]);

  // Calculate costs whenever values change
  useEffect(() => {
    if (totalFixedCents > 0) {
      const monthlyFixedCostsCents = totalFixedCents;
      const timeCosts = calculateTimeCosts({
        workDaysPerMonth: workDays,
        hoursPerDay: hoursPerDay,
        effectiveWorkPercentage: realPct / 100, // Convertir porcentaje a decimal
      }, monthlyFixedCostsCents);
      setResults(timeCosts);
    }
  }, [workDays, hoursPerDay, realPct, totalFixedCents]);

  const loadData = async () => {
    if (!currentClinic?.id) return; // ✅ No cargar sin clínica
    
    setLoadingData(true);
    try {
      // Load time settings for current clinic
      const timeResponse = await fetch(`/api/settings/time?clinicId=${currentClinic.id}`);
      if (timeResponse.ok) {
        const timeData = await timeResponse.json();
        if (timeData.data) {
          reset({
            work_days: timeData.data.work_days,
            hours_per_day: timeData.data.hours_per_day,
            real_pct: timeData.data.real_pct * 100, // Convertir de decimal a porcentaje para mostrar
          });
        }
      }

      // Load fixed costs to get total for current clinic
      const costsResponse = await fetch(`/api/fixed-costs?clinicId=${currentClinic.id}`);
      if (costsResponse.ok) {
        const costsData = await costsResponse.json();
        const costs = costsData.data || [];
        setFixedCosts(costs);
        const total = costs.reduce((sum: number, cost: FixedCost) => sum + cost.amount_cents, 0);
        // Load assets monthly depreciation and add to total
        try {
          const assetsSummaryRes = await fetch(`/api/assets/summary?clinicId=${currentClinic.id}`);
          if (assetsSummaryRes.ok) {
            const assetsSummary = await assetsSummaryRes.json();
            const monthlyDep = assetsSummary?.data?.monthly_depreciation_cents || 0;
            setAssetsMonthlyDepCents(monthlyDep);
            setTotalFixedCents(total + monthlyDep);
          } else {
            setTotalFixedCents(total);
          }
        } catch {
          setTotalFixedCents(total);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: TimeSettingsForm) => {
    try {
      // Convertir porcentaje a decimal antes de enviar
      const dataToSend = {
        ...data,
        real_pct: data.real_pct / 100, // Convertir 80 a 0.8
      };
      
      // Save to API
      const response = await fetch('/api/settings/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        throw new Error('Failed to save time settings');
      }

      // Calculate costs using real fixed costs total or fallback
      const monthlyFixedCostsCents = totalFixedCents || 1_854_533;
      
      const timeCosts = calculateTimeCosts({
        workDaysPerMonth: data.work_days,
        hoursPerDay: data.hours_per_day,
        effectiveWorkPercentage: data.real_pct / 100, // Convertir porcentaje a decimal
      }, monthlyFixedCostsCents);
      
      setResults(timeCosts);
      
      // Show success message (you could add a toast here)
      console.log('Time settings saved successfully:', timeCosts);
      
      // Navigate to home after successful save
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error) {
      console.error('Error saving time settings:', error);
      // Show error message (you could add a toast here)
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('time.title')}
        subtitle={t('time.subtitle')}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('time.formTitle')}</CardTitle>
            <CardDescription>
              {t('time.formDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                label={t('time.workDaysPerMonth')}
                error={errors.work_days?.message}
                required
              >
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="31"
                  disabled={loadingData}
                  {...register('work_days', { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                label={t('time.hoursPerDay')}
                error={errors.hours_per_day?.message}
                required
              >
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  max="16"
                  disabled={loadingData}
                  {...register('hours_per_day', { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                label={t('time.effectiveWorkPercentage')}
                description="Ingresa el porcentaje (ej: 80 para 80%)"
                error={errors.real_pct?.message}
                required
              >
                <div className="relative">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    disabled={loadingData}
                    {...register('real_pct', { valueAsNumber: true })}
                    placeholder="80"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">%</span>
                </div>
              </FormField>

              <Button type="submit" disabled={isSubmitting || loadingData} className="w-full">
                {isSubmitting ? t('common.loading') : t('common.save')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
          {/* Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle>{t('time.preview')}</CardTitle>
              <CardDescription>
                {t('time.livePreviewDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalFixedCents > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>{t('time.monthlyFixedCosts')}:</strong> {formatCurrency(totalFixedCents)}
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('time.plannedHoursPerMonth')}</p>
                  <p className="text-2xl font-bold">
                    {(workDays * hoursPerDay).toFixed(1)} hrs
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {workDays} {t('time.days')} × {hoursPerDay} {t('time.hoursPerDayShort')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('time.realHoursPerMonth')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(workDays * hoursPerDay * (realPct / 100)).toFixed(1)} hrs
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {realPct}% {t('time.ofPlannedHours')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculated Results */}
          {results && (
            <Card>
              <CardHeader>
                <CardTitle>{t('time.calculatedCosts')}</CardTitle>
                <CardDescription>
                  {t('time.basedOnFixedCosts')} {formatCurrency(results.monthlyFixedCostsCents)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{t('time.fixedCostPerHour')}</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(results.fixedPerMinuteCents * 60)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-3">
                      <span className="text-sm font-medium">{t('time.fixedCostPerMinute')}</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(results.fixedPerMinuteCents)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground text-center">
                    {t('time.formula')}: {t('time.monthlyFixedCosts')} ÷ {t('time.realHoursPerMonth')} ÷ 60
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}