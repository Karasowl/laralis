'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { DollarSign, TrendingUp, Star, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ServiceROIData {
  service_id: string
  service_name: string
  total_sales: number
  total_revenue_cents: number
  total_cost_cents: number
  total_profit_cents: number
  avg_profit_per_sale_cents: number
  avg_revenue_per_sale_cents: number
  profit_per_hour_cents: number
  roi_percentage: number
  category: 'star' | 'gem' | 'volume' | 'review'
}

interface ProfitabilitySummaryProps {
  services: ServiceROIData[]
  loading?: boolean
}

export function ProfitabilitySummary({ services, loading }: ProfitabilitySummaryProps) {
  const t = useTranslations('dashboard.profitability')
  const tCommon = useTranslations('common')

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!services || services.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            {t('no_data')}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate summary metrics
  const totalRevenue = services.reduce((sum, s) => sum + s.total_revenue_cents, 0)
  const totalCost = services.reduce((sum, s) => sum + s.total_cost_cents, 0)
  const totalProfit = services.reduce((sum, s) => sum + s.total_profit_cents, 0)

  const averageMargin = totalRevenue > 0
    ? ((totalProfit / totalRevenue) * 100)
    : 0

  const averageROI = totalCost > 0
    ? ((totalProfit / totalCost) * 100)
    : 0

  // Find star service (highest profit per hour)
  const starService = services.reduce((best, current) => {
    if (!best || current.profit_per_hour_cents > best.profit_per_hour_cents) {
      return current
    }
    return best
  }, services[0])

  // Find highest cost service
  const highestCostService = services.reduce((highest, current) => {
    if (!highest || current.total_cost_cents > highest.total_cost_cents) {
      return current
    }
    return highest
  }, services[0])

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Average Margin */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('average_margin')}
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {averageMargin.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('last_30_days')}
          </p>
        </CardContent>
      </Card>

      {/* Average ROI */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('average_roi')}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {averageROI.toFixed(0)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(totalRevenue)} / {formatCurrency(totalCost)}
          </p>
        </CardContent>
      </Card>

      {/* Star Service */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('star_service')}
          </CardTitle>
          <Star className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold truncate">
            {starService.service_name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              {formatCurrency(starService.profit_per_hour_cents)}{t('perHour')}
            </p>
            <Badge variant="secondary" className="text-[10px] sm:text-xs whitespace-nowrap">
              ROI {starService.roi_percentage.toFixed(0)}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Highest Cost Service */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('highest_cost')}
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold truncate">
            {highestCostService.service_name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              {formatCurrency(highestCostService.total_cost_cents)} {tCommon('cost')}
            </p>
            <Badge
              variant={highestCostService.roi_percentage < 100 ? "destructive" : "secondary"}
              className="text-[10px] sm:text-xs whitespace-nowrap"
            >
              ROI {highestCostService.roi_percentage.toFixed(0)}%
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
