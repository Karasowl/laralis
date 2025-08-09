'use client';

import { useTranslations } from 'next-intl';
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
import type { SettingsTime, FixedCost } from '@/lib/types';
import { useState, useEffect } from 'react';

type TimeSettingsForm = {
  work_days: number;
  hours_per_day: number;
  real_pct: number;
};

export default function TimeSettingsPage() {
  const t = useTranslations();
  const [results, setResults] = useState<any>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [totalFixedCents, setTotalFixedCents] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TimeSettingsForm>({
    resolver: zodResolver(zSettingsTimeForm),
    defaultValues: {
      work_days: 20,
      hours_per_day: 7,
      real_pct: 0.8,
    },
  });

  const watchedValues = watch();

  // Load existing data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Load time settings
      const timeResponse = await fetch('/api/settings/time');
      if (timeResponse.ok) {
        const timeData = await timeResponse.json();
        if (timeData.data) {
          reset({
            work_days: timeData.data.work_days,
            hours_per_day: timeData.data.hours_per_day,
            real_pct: timeData.data.real_pct,
          });
        }
      }

      // Load fixed costs to get total
      const costsResponse = await fetch('/api/fixed-costs');
      if (costsResponse.ok) {
        const costsData = await costsResponse.json();
        const costs = costsData.data || [];
        setFixedCosts(costs);
        const total = costs.reduce((sum: number, cost: FixedCost) => sum + cost.amount_cents, 0);
        setTotalFixedCents(total);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const onSubmit = async (data: TimeSettingsForm) => {
    try {
      // Save to API
      const response = await fetch('/api/settings/time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save time settings');
      }

      // Calculate costs using real fixed costs total or fallback
      const monthlyFixedCostsCents = totalFixedCents || 1_854_533;
      
      const timeCosts = calculateTimeCosts({
        workDaysPerMonth: data.work_days,
        hoursPerDay: data.hours_per_day,
        effectiveWorkPercentage: data.real_pct,
      }, monthlyFixedCostsCents);
      
      setResults(timeCosts);
      
      // Show success message (you could add a toast here)
      console.log('Time settings saved successfully:', timeCosts);
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
            <CardTitle>Configuración de Tiempo</CardTitle>
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
                description="Como decimal (ej: 0.8 = 80%)"
                error={errors.real_pct?.message}
                required
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1"
                  disabled={loadingData}
                  {...register('real_pct', { valueAsNumber: true })}
                />
              </FormField>

              <Button type="submit" disabled={isSubmitting || loadingData} className="w-full">
                {isSubmitting ? t('time.calculating') : t('time.calculate')}
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
                Valores calculados en tiempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalFixedCents > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Costos fijos mensuales:</strong> {formatCurrency(totalFixedCents)}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">{t('time.totalMinutesPerMonth')}</p>
                  <p className="text-muted-foreground">
                    {(watchedValues.work_days * watchedValues.hours_per_day * 60).toLocaleString()} min
                  </p>
                </div>
                <div>
                  <p className="font-medium">{t('time.effectiveMinutesPerMonth')}</p>
                  <p className="text-muted-foreground">
                    {Math.round(
                      watchedValues.work_days * 
                      watchedValues.hours_per_day * 
                      60 * 
                      watchedValues.real_pct
                    ).toLocaleString()} min
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculated Results */}
          {results && (
            <Card>
              <CardHeader>
                <CardTitle>{t('time.results')}</CardTitle>
                <CardDescription>
                  Basado en costos fijos mensuales de {formatCurrency(results.monthlyFixedCostsCents)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="font-medium">{t('time.fixedCostPerMinute')}</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(results.fixedPerMinuteCents)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-medium">Minutos Totales</p>
                      <p className="text-2xl font-bold text-muted-foreground">
                        {results.totalMinutesPerMonth.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">Minutos Efectivos</p>
                      <p className="text-2xl font-bold text-green-600">
                        {results.effectiveMinutesPerMonth.toLocaleString()}
                      </p>
                    </div>
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