'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Megaphone,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Calendar,
  Lightbulb
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMarketingROI } from '@/hooks/use-marketing-roi'

interface MarketingROISimpleProps {
  clinicId?: string
  months?: number
}

export function MarketingROISimple({ clinicId, months = 6 }: MarketingROISimpleProps) {
  const t = useTranslations('dashboardComponents.marketingROI')
  const { data, loading, error } = useMarketingROI({ clinicId, months })

  const insights = useMemo(() => {
    if (!data) return null

    const { summary, periods } = data

    // Find best and worst performing months
    const sortedPeriods = [...periods]
      .filter(p => p.investmentCents > 0)
      .sort((a, b) => b.roi - a.roi)

    const bestMonth = sortedPeriods[0]
    const worstMonth = sortedPeriods[sortedPeriods.length - 1]

    // Calculate trend (last 3 months vs previous 3 months)
    const recent = periods.slice(0, 3)
    const previous = periods.slice(3, 6)

    const recentROI = recent.reduce((sum, p) => sum + p.roi, 0) / Math.max(recent.length, 1)
    const previousROI = previous.reduce((sum, p) => sum + p.roi, 0) / Math.max(previous.length, 1)
    const trend = recentROI - previousROI

    return {
      bestMonth,
      worstMonth,
      trend,
      hasData: periods.length > 0 && summary.totalInvestmentCents > 0
    }
  }, [data])

  const getROIColor = (roi: number) => {
    if (roi >= 200) return 'text-emerald-600 dark:text-emerald-400'
    if (roi >= 100) return 'text-green-600 dark:text-green-400'
    if (roi >= 0) return 'text-primary dark:text-primary/80'
    return 'text-destructive'
  }

  const getROIBgColor = (roi: number) => {
    if (roi >= 200) return 'bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
    if (roi >= 100) return 'bg-green-100 dark:bg-green-950/30 border-green-200 dark:border-green-900'
    if (roi >= 0) return 'bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary/40 backdrop-blur-sm'
    return 'bg-destructive/10 dark:bg-destructive/20 border-destructive/30 dark:border-destructive/40 backdrop-blur-sm'
  }

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    const monthName = new Intl.DateTimeFormat('es', { month: 'short' }).format(date)
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !insights?.hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t('noData')}</p>
            <p className="text-xs mt-2">{t('noDataHint')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { summary, periods } = data!

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.01]">
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 backdrop-blur-sm flex items-center justify-center mb-2">
              <Megaphone className="h-5 w-5 text-primary dark:text-primary/80" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.totalInvestment')}
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.totalInvestmentCents)}
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.01]">
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
              <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.totalRevenue')}
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.totalRevenueCents)}
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.01]">
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 dark:bg-secondary/20 backdrop-blur-sm flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-secondary dark:text-secondary/80" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.avgROI')}
            </p>
            <p className={cn('text-2xl font-bold', getROIColor(summary.overallROI))}>
              {summary.overallROI.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.01]">
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('overview.totalPatients')}
            </p>
            <p className="text-2xl font-bold">{summary.totalPatients}</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Best Month */}
        {insights.bestMonth && (
          <Card className="border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                {t('insights.bestMonth')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
                  {formatPeriod(insights.bestMonth.period)}
                </p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-700 dark:text-emerald-400">ROI:</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-300">
                  {insights.bestMonth.roi.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-700 dark:text-emerald-400">{t('insights.revenue')}:</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-300">
                  {formatCurrency(insights.bestMonth.revenueCents)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend */}
        <Card className={cn(
          'border-2 transition-all duration-200 hover:shadow-lg hover:scale-[1.01]',
          insights.trend >= 0
            ? 'border-primary/30 dark:border-primary/40 bg-primary/5 dark:bg-primary/10'
            : 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className={cn(
              'text-base flex items-center gap-2',
              insights.trend >= 0
                ? 'text-primary dark:text-primary/80'
                : 'text-amber-700 dark:text-amber-400'
            )}>
              {insights.trend >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {t('insights.trend')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={cn(
              'text-2xl font-bold',
              insights.trend >= 0
                ? 'text-primary dark:text-primary/80'
                : 'text-amber-900 dark:text-amber-300'
            )}>
              {insights.trend >= 0 ? '+' : ''}{insights.trend.toFixed(1)}%
            </p>
            <p className={cn(
              'text-xs',
              insights.trend >= 0
                ? 'text-primary dark:text-primary/80'
                : 'text-amber-700 dark:text-amber-400'
            )}>
              {t('insights.trendDescription')}
            </p>
          </CardContent>
        </Card>

        {/* Cost per Patient */}
        <Card className="border-2 border-secondary/30 dark:border-secondary/40 bg-secondary/5 dark:bg-secondary/10 transition-all duration-200 hover:shadow-lg hover:scale-[1.01]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-secondary dark:text-secondary/80">
              <DollarSign className="h-4 w-4" />
              {t('insights.costPerPatient')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-secondary dark:text-secondary/80">
              {formatCurrency(summary.avgInvestmentPerPatientCents)}
            </p>
            <p className="text-xs text-secondary dark:text-secondary/80">
              {t('insights.revenuePerPatient')}: {formatCurrency(summary.avgRevenuePerPatientCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <Card className="transition-all duration-200 hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {t('table.title')}
          </CardTitle>
          <CardDescription>{t('table.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.period')}</TableHead>
                  <TableHead className="text-right">{t('table.investment')}</TableHead>
                  <TableHead className="text-right">{t('table.revenue')}</TableHead>
                  <TableHead className="text-right">{t('table.patients')}</TableHead>
                  <TableHead className="text-right">{t('table.roi')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.filter(p => p.investmentCents > 0).map((period) => (
                  <TableRow key={period.period}>
                    <TableCell className="font-medium">
                      {formatPeriod(period.period)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(period.investmentCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(period.revenueCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {period.patientsCount}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={cn('gap-1', getROIBgColor(period.roi))}>
                        {period.roi > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span className={getROIColor(period.roi)}>
                          {period.roi.toFixed(0)}%
                        </span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Help Text */}
          <div className="mt-4 p-3 bg-primary/5 dark:bg-primary/10 backdrop-blur-sm border border-primary/30 dark:border-primary/40 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-primary dark:text-primary/80 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-primary dark:text-primary/80">
                <p className="font-medium mb-1">{t('help.title')}</p>
                <p>{t('help.description')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
