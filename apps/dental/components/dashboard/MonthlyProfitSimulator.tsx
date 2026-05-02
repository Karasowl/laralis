'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calculator, TrendingUp, DollarSign, Users, Calendar, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MonthlyProfitSimulatorProps {
  monthlyTargetCents: number
  currentRevenueCents: number
  ticketPromedioCents: number
  daysRemaining: number
  totalFixedCostsCents: number
  totalVariableCostsCents: number
  loading?: boolean
}

export function MonthlyProfitSimulator({
  monthlyTargetCents,
  currentRevenueCents,
  ticketPromedioCents,
  daysRemaining,
  totalFixedCostsCents,
  totalVariableCostsCents,
  loading = false
}: MonthlyProfitSimulatorProps) {
  const t = useTranslations('dashboardComponents.profitSimulator')
  const [extraPatients, setExtraPatients] = useState(0)

  // Calculate missing patients for break-even
  const missingPatients = useMemo(() => {
    const revenueGap = monthlyTargetCents - currentRevenueCents
    if (revenueGap <= 0 || ticketPromedioCents <= 0) return 0
    return Math.ceil(revenueGap / ticketPromedioCents)
  }, [monthlyTargetCents, currentRevenueCents, ticketPromedioCents])

  // Calculate current net profit
  const currentNetProfitCents = useMemo(() => {
    return currentRevenueCents - totalFixedCostsCents - totalVariableCostsCents
  }, [currentRevenueCents, totalFixedCostsCents, totalVariableCostsCents])

  // Calculate simulated profit with extra patients
  const simulatedResult = useMemo(() => {
    const totalPatientsToAdd = missingPatients + extraPatients
    const additionalRevenueCents = totalPatientsToAdd * ticketPromedioCents

    // Estimate additional variable costs (assume 30% of revenue)
    const additionalVariableCostsCents = Math.round(additionalRevenueCents * 0.30)

    const finalRevenueCents = currentRevenueCents + additionalRevenueCents
    const finalVariableCostsCents = totalVariableCostsCents + additionalVariableCostsCents
    const finalNetProfitCents = finalRevenueCents - totalFixedCostsCents - finalVariableCostsCents

    const profitAboveBreakEvenCents = finalRevenueCents - monthlyTargetCents
    const profitAboveBreakEvenPercent = monthlyTargetCents > 0
      ? Math.round((profitAboveBreakEvenCents / monthlyTargetCents) * 100)
      : 0

    return {
      finalRevenueCents,
      finalNetProfitCents,
      profitAboveBreakEvenCents,
      profitAboveBreakEvenPercent,
      additionalRevenueCents,
      additionalVariableCostsCents
    }
  }, [missingPatients, extraPatients, ticketPromedioCents, currentRevenueCents, totalFixedCostsCents, totalVariableCostsCents, monthlyTargetCents])

  const quickOptions = [0, 5, 10, 15, 20]

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('daysRemaining')}</p>
              <p className="text-xl font-bold">{daysRemaining} {t('days')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('patientsNeeded')}</p>
              <p className="text-xl font-bold">{missingPatients} {t('patients')}</p>
            </div>
          </div>
        </div>

        {/* Simulator */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            <h4 className="font-semibold text-lg">{t('simulator.title')}</h4>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {t('simulator.description')}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {quickOptions.map((option) => (
                <Button
                  key={option}
                  variant={extraPatients === option ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExtraPatients(option)}
                  className="min-w-[60px]"
                >
                  +{option}
                </Button>
              ))}
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-muted-foreground">{t('simulator.custom')}:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={extraPatients}
                  onChange={(e) => setExtraPatients(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 px-3 py-1 text-sm border rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Result */}
          <div className={cn(
            "p-4 rounded-lg border-2",
            simulatedResult.profitAboveBreakEvenCents >= 0
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
              : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
          )}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('simulator.totalPatients')}:</span>
                <span className="text-lg font-bold">
                  {missingPatients + extraPatients} {t('patients')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('simulator.additionalRevenue')}:</span>
                <span className="text-lg font-bold text-emerald-600">
                  +{formatCurrency(simulatedResult.additionalRevenueCents)}
                </span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('simulator.netProfit')}:</span>
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(simulatedResult.finalNetProfitCents)}
                </span>
              </div>
              {simulatedResult.profitAboveBreakEvenCents >= 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <Badge className="bg-emerald-600 text-white">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {simulatedResult.profitAboveBreakEvenPercent}% {t('simulator.aboveBreakEven')}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current Net Profit Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <h4 className="font-semibold text-lg">{t('breakdown.title')}</h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <span className="text-sm font-medium">{t('breakdown.revenue')}</span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(currentRevenueCents)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
              <span className="text-sm font-medium">{t('breakdown.fixedCosts')}</span>
              <span className="text-lg font-bold text-red-700 dark:text-red-400">
                -{formatCurrency(totalFixedCostsCents)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <span className="text-sm font-medium">{t('breakdown.variableCosts')}</span>
              <span className="text-lg font-bold text-orange-700 dark:text-orange-400">
                -{formatCurrency(totalVariableCostsCents)}
              </span>
            </div>

            <div className="h-px bg-border my-2" />

            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-950/30 dark:to-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-900">
              <span className="text-base font-semibold text-emerald-900 dark:text-emerald-300">
                {t('breakdown.netProfit')}
              </span>
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(currentNetProfitCents)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
