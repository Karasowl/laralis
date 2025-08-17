'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkspace } from '@/contexts/workspace-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/format';
import { Calculator, TrendingUp, AlertTriangle, Target, DollarSign } from 'lucide-react';

interface EquilibriumData {
  fixedCostsCents: number;
  variableCostPercentage: number;
  contributionMargin: number;
  breakEvenRevenueCents: number;
  dailyTargetCents: number;
  safetyMarginCents: number;
  workDays: number;
}

export default function EquilibriumPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual
  const [loading, setLoading] = useState(true);
  const [fixedCostsCents, setFixedCostsCents] = useState(0);
  const [workDays, setWorkDays] = useState(20);
  const [variableCostPercentage, setVariableCostPercentage] = useState(35);

  // ✅ Recargar cuando cambie la clínica
  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id]);

  const loadData = async () => {
    if (!currentClinic?.id) return; // ✅ No cargar sin clínica
    
    setLoading(true);
    try {
      // Load fixed costs total for current clinic
      const [fixedCostsResponse, assetsResponse, timeResponse] = await Promise.all([
        fetch(`/api/fixed-costs?clinicId=${currentClinic.id}`),
        fetch(`/api/assets/summary?clinicId=${currentClinic.id}`),
        fetch(`/api/settings/time?clinicId=${currentClinic.id}`)
      ]);

      let totalFixedCents = 0;

      // Get manual fixed costs
      if (fixedCostsResponse.ok) {
        const fixedData = await fixedCostsResponse.json();
        const costs = fixedData.data || [];
        totalFixedCents = costs.reduce((sum: number, cost: any) => sum + cost.amount_cents, 0);
      }

      // Add assets depreciation
      if (assetsResponse.ok) {
        const assetsData = await assetsResponse.json();
        const depreciation = assetsData.data?.monthly_depreciation_cents || 0;
        totalFixedCents += depreciation;
      }

      setFixedCostsCents(totalFixedCents);

      // Get work days from time settings
      if (timeResponse.ok) {
        const timeData = await timeResponse.json();
        if (timeData.data?.work_days) {
          setWorkDays(timeData.data.work_days);
        }
      }
    } catch (error) {
      console.error('Error loading equilibrium data:', error);
    } finally {
      setLoading(false);
    }
  };

  const equilibriumData = useMemo((): EquilibriumData => {
    const contributionMargin = (100 - variableCostPercentage) / 100;
    const breakEvenRevenueCents = contributionMargin > 0 ? Math.round(fixedCostsCents / contributionMargin) : 0;
    const dailyTargetCents = workDays > 0 ? Math.round(breakEvenRevenueCents / workDays) : 0;
    const safetyMarginCents = Math.round(breakEvenRevenueCents * 1.2); // 20% safety margin

    return {
      fixedCostsCents,
      variableCostPercentage,
      contributionMargin: contributionMargin * 100,
      breakEvenRevenueCents,
      dailyTargetCents,
      safetyMarginCents,
      workDays
    };
  }, [fixedCostsCents, variableCostPercentage, workDays]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('equilibrium.title')}
        subtitle={t('equilibrium.subtitle')}
      />

      {loading ? (
        <div className="text-center p-8">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Parameters */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  {t('equilibrium.inputs.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>{t('equilibrium.inputs.monthlyFixedCosts')}</Label>
                  <Input
                    type="text"
                    value={formatCurrency(fixedCostsCents, locale as 'en' | 'es')}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    {fixedCostsCents === 0 && t('equilibrium.warning.missingData')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variable-cost">
                    {t('equilibrium.inputs.variableCostPercentage')}
                  </Label>
                  <Input
                    id="variable-cost"
                    type="number"
                    min="0"
                    max="90"
                    step="1"
                    value={variableCostPercentage}
                    onChange={(e) => setVariableCostPercentage(Number(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('equilibrium.inputs.variableCostHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('equilibrium.inputs.contributionMargin')}</Label>
                  <Input
                    type="text"
                    value={`${equilibriumData.contributionMargin.toFixed(1)}%`}
                    disabled
                    className="bg-blue-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('equilibrium.inputs.contributionMarginHelp')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Formula Explanation */}
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-800">
                  {t('equilibrium.formula.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>{t('equilibrium.formula.explanation')}</strong>
                  </p>
                  <p className="text-xs">
                    <strong>{t('equilibrium.formula.where')}</strong><br />
                    {t('equilibrium.formula.marginContribution')}
                  </p>
                  <div className="bg-white p-3 rounded border text-xs font-mono">
                    {formatCurrency(fixedCostsCents, locale as 'en' | 'es')} ÷ {equilibriumData.contributionMargin.toFixed(1)}% = {formatCurrency(equilibriumData.breakEvenRevenueCents, locale as 'en' | 'es')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  {t('equilibrium.results.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-green-800">
                        {t('equilibrium.results.breakEvenRevenue')}
                      </h3>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-green-700 mb-1">
                    {formatCurrency(equilibriumData.breakEvenRevenueCents, locale as 'en' | 'es')}
                  </div>
                  <p className="text-sm text-green-600">
                    {t('equilibrium.results.breakEvenRevenueHelp')}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-800">
                      {t('equilibrium.results.dailyTarget')}
                    </h3>
                  </div>
                  <div className="text-2xl font-bold text-blue-700 mb-1">
                    {formatCurrency(equilibriumData.dailyTargetCents, locale as 'en' | 'es')}
                  </div>
                  <p className="text-sm text-blue-600">
                    {t('equilibrium.results.dailyTargetHelp')}
                  </p>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-orange-800">
                      {t('equilibrium.results.safetyMargin')}
                    </h3>
                  </div>
                  <div className="text-2xl font-bold text-orange-700 mb-1">
                    {formatCurrency(equilibriumData.safetyMarginCents, locale as 'en' | 'es')}
                  </div>
                  <p className="text-sm text-orange-600">
                    {t('equilibrium.results.safetyMarginHelp')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Warning Card */}
            {fixedCostsCents === 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-5 w-5" />
                    {t('equilibrium.warning.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-amber-700 mb-3">
                    {t('equilibrium.warning.missingData')}
                  </p>
                  <ul className="space-y-1 text-sm text-amber-600">
                    <li>{t('equilibrium.warning.steps.assets')}</li>
                    <li>{t('equilibrium.warning.steps.fixedCosts')}</li>
                    <li>{t('equilibrium.warning.steps.timeCosts')}</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}