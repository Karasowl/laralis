'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Gem, Package, AlertTriangle, Star, DollarSign, Activity, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ServiceROI, ROIAnalysis } from '@/app/api/analytics/service-roi/route'

interface ServiceROIAnalysisProps {
  data: ROIAnalysis | null
  loading?: boolean
}

export function ServiceROIAnalysis({ data, loading = false }: ServiceROIAnalysisProps) {
  const t = useTranslations('dashboardComponents.serviceROI')

  const getCategoryIcon = (category: ServiceROI['category']) => {
    switch (category) {
      case 'star': return <Star className="h-4 w-4" />
      case 'gem': return <Gem className="h-4 w-4" />
      case 'volume': return <Package className="h-4 w-4" />
      case 'review': return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: ServiceROI['category']) => {
    switch (category) {
      case 'star': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/30'
      case 'gem': return 'text-purple-600 bg-purple-100 dark:bg-purple-950/30'
      case 'volume': return 'text-blue-600 bg-blue-100 dark:bg-blue-950/30'
      case 'review': return 'text-red-600 bg-red-100 dark:bg-red-950/30'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.services.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t('noData')}</p>
            <p className="text-xs mt-2">{t('noDataHint')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-2">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('summary.totalProfit')}
            </p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold text-emerald-600 tabular-nums">
              {formatCurrency(data.totals.total_profit_cents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center mb-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('summary.totalSales')}
            </p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold tabular-nums">{data.totals.total_sales}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center mb-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('summary.avgROI')}
            </p>
            <p className="text-base sm:text-lg lg:text-2xl font-bold tabular-nums">{data.totals.avg_roi_percentage}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {t('summary.period')}
            </p>
            <p className="text-xs sm:text-sm font-semibold">{t('summary.lastDays', { days: 30 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis Tabs */}
      <Tabs defaultValue="total" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar">
          <TabsTrigger value="total" className="flex-1 min-w-0 px-2 sm:px-3">
            <DollarSign className="h-4 w-4 sm:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline truncate">{t('tabs.total')}</span>
          </TabsTrigger>
          <TabsTrigger value="unit" className="flex-1 min-w-0 px-2 sm:px-3">
            <Gem className="h-4 w-4 sm:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline truncate">{t('tabs.unit')}</span>
          </TabsTrigger>
          <TabsTrigger value="matrix" className="flex-1 min-w-0 px-2 sm:px-3">
            <Activity className="h-4 w-4 sm:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline truncate">{t('tabs.matrix')}</span>
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex-1 min-w-0 px-2 sm:px-3">
            <TrendingUp className="h-4 w-4 sm:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline truncate">{t('tabs.opportunities')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Total Profit */}
        <TabsContent value="total">
          <Card>
            <CardHeader>
              <CardTitle>{t('totalProfit.title')}</CardTitle>
              <CardDescription>{t('totalProfit.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.services.map((service, index) => (
                  <div
                    key={service.service_id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{service.service_name}</p>
                          <Badge className={cn('text-xs', getCategoryColor(service.category))}>
                            {getCategoryIcon(service.category)}
                            <span className="ml-1">{service.category_label}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{t('totalProfit.sales', { count: service.total_sales })}</span>
                          <span>•</span>
                          <span>{t('totalProfit.avgPerSale', { amount: formatCurrency(service.avg_profit_per_sale_cents) })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base sm:text-lg lg:text-2xl font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(service.total_profit_cents)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        ROI: {service.roi_percentage}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Profit per Unit */}
        <TabsContent value="unit">
          <Card>
            <CardHeader>
              <CardTitle>{t('profitPerUnit.title')}</CardTitle>
              <CardDescription>{t('profitPerUnit.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...data.services]
                  .sort((a, b) => b.avg_profit_per_sale_cents - a.avg_profit_per_sale_cents)
                  .map((service, index) => (
                    <div
                      key={service.service_id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/30 text-purple-600 font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{service.service_name}</p>
                            {service.total_sales < 5 && (
                              <Badge variant="outline" className="text-xs">
                                {t('profitPerUnit.lowVolume')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{t('profitPerUnit.sold', { count: service.total_sales })}</span>
                            <span>•</span>
                            <span>{formatCurrency(service.profit_per_hour_cents)}/hr</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base sm:text-lg lg:text-2xl font-bold text-purple-600 tabular-nums">
                          {formatCurrency(service.avg_profit_per_sale_cents)}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {t('profitPerUnit.perSale')}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Matrix */}
        <TabsContent value="matrix">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Stars */}
            {data.services.filter(s => s.category === 'star').length > 0 && (
              <Card className="border-2 border-yellow-200 dark:border-yellow-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <Star className="h-4 w-4" />
                    {t('matrix.stars')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('matrix.starsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.services.filter(s => s.category === 'star').map(service => (
                    <div key={service.service_id} className="text-sm">
                      <p className="font-semibold">{service.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.total_sales} {t('matrix.sales')} • {formatCurrency(service.total_profit_cents)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Gems */}
            {data.insights.hidden_gems.length > 0 && (
              <Card className="border-2 border-purple-200 dark:border-purple-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <Gem className="h-4 w-4" />
                    {t('matrix.gems')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('matrix.gemsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.insights.hidden_gems.map(service => (
                    <div key={service.service_id} className="text-sm">
                      <p className="font-semibold">{service.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(service.avg_profit_per_sale_cents)}/{t('matrix.perSale')} • {service.total_sales} {t('matrix.sales')}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Volume */}
            {data.services.filter(s => s.category === 'volume').length > 0 && (
              <Card className="border-2 border-blue-200 dark:border-blue-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Package className="h-4 w-4" />
                    {t('matrix.volume')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('matrix.volumeDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.services.filter(s => s.category === 'volume').map(service => (
                    <div key={service.service_id} className="text-sm">
                      <p className="font-semibold">{service.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.total_sales} {t('matrix.sales')} • {formatCurrency(service.avg_profit_per_sale_cents)}/{t('matrix.perSale')}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Review */}
            {data.insights.needs_review.length > 0 && (
              <Card className="border-2 border-red-200 dark:border-red-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    {t('matrix.review')}
                  </CardTitle>
                  <CardDescription className="text-xs">{t('matrix.reviewDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.insights.needs_review.map(service => (
                    <div key={service.service_id} className="text-sm">
                      <p className="font-semibold">{service.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.total_sales} {t('matrix.sales')} • ROI: {service.roi_percentage}%
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Opportunities */}
        <TabsContent value="opportunities">
          <Card>
            <CardHeader>
              <CardTitle>{t('opportunities.title')}</CardTitle>
              <CardDescription>{t('opportunities.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {data.insights.hidden_gems.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Gem className="h-4 w-4 text-purple-600" />
                      {t('opportunities.hiddenGems')}
                    </h4>
                    <div className="space-y-3">
                      {data.insights.hidden_gems.map(service => {
                        const potentialMonthly = service.avg_profit_per_sale_cents * 2
                        const potentialAnnual = potentialMonthly * 12

                        return (
                          <div key={service.service_id} className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                            <p className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
                              {service.service_name}
                            </p>
                            <div className="space-y-1 text-sm text-purple-800 dark:text-purple-400">
                              <p>• {t('opportunities.current')}: {formatCurrency(service.total_profit_cents)} ({service.total_sales} {t('opportunities.sales')})</p>
                              <p>• {t('opportunities.ifDouble')}: +{formatCurrency(potentialMonthly)}/{t('opportunities.month')}</p>
                              <p className="font-semibold">• {t('opportunities.potential')}: +{formatCurrency(potentialAnnual)}/{t('opportunities.year')}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {data.insights.needs_review.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      {t('opportunities.needsAction')}
                    </h4>
                    <div className="space-y-3">
                      {data.insights.needs_review.map(service => (
                        <div key={service.service_id} className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                          <p className="font-semibold text-red-900 dark:text-red-300 mb-2">
                            {service.service_name}
                          </p>
                          <div className="space-y-1 text-sm text-red-800 dark:text-red-400">
                            <p>• ROI: {service.roi_percentage}% ({t('opportunities.belowExpected')})</p>
                            <p>• {t('opportunities.profitPerSale')}: {formatCurrency(service.avg_profit_per_sale_cents)}</p>
                            <p className="font-semibold mt-2">💡 {t('opportunities.suggestion')}: {t('opportunities.reviewPricing')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
