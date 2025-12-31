'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { useClinicCurrency } from '@/hooks/use-clinic-currency'
import { DollarSign, TrendingUp, Target, Users, Info, CheckCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface MarketingMetricsProps {
  cac: number // Customer Acquisition Cost in cents
  ltv: number // Lifetime Value in cents
  conversionRate: number // Percentage 0-100
  campaignRevenue?: number // Revenue from campaigns in cents
  adSpend?: number // Ad spend in cents
  loading?: boolean
}

export function MarketingMetrics({ cac, ltv, conversionRate, campaignRevenue = 0, adSpend = 0, loading }: MarketingMetricsProps) {
  const t = useTranslations('dashboard.marketing')
  const tCommon = useTranslations('common')
  const { format: formatCurrency } = useClinicCurrency()

  if (loading) {
    return (
      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 sm:p-6">
              <div className="h-4 bg-muted rounded w-20 sm:w-24 animate-pulse mb-2" />
              <div className="h-6 sm:h-8 bg-muted rounded w-24 sm:w-32 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Calculate LTV/CAC ratio
  const ltvCacRatio = cac > 0 ? ltv / cac : 0

  // Calculate ROAS (Return On Ad Spend)
  const roas = adSpend > 0 ? campaignRevenue / adSpend : null

  // Determine health status based on industry benchmarks
  const ratioStatus = ltvCacRatio >= 3
    ? { label: t('excellent'), color: 'bg-emerald-500', variant: 'default' as const }
    : ltvCacRatio >= 2
    ? { label: t('good'), color: 'bg-blue-500', variant: 'secondary' as const }
    : ltvCacRatio >= 1
    ? { label: t('acceptable'), color: 'bg-amber-500', variant: 'outline' as const }
    : { label: t('critical'), color: 'bg-red-500', variant: 'destructive' as const }

  const conversionStatus = conversionRate >= 15
    ? { label: t('high'), color: 'text-emerald-600' }
    : conversionRate >= 8
    ? { label: t('average'), color: 'text-blue-600' }
    : { label: t('low'), color: 'text-amber-600' }

  return (
    <TooltipProvider>
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 lg:grid-cols-5">
          {/* CAC - Customer Acquisition Cost */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600">
                  <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('cac')}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      className="max-w-[280px] sm:max-w-xs z-50"
                      side="bottom"
                      sideOffset={8}
                      collisionPadding={16}
                      avoidCollisions={true}
                    >
                      <p>{t('cac_tooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg sm:text-2xl font-bold tabular-nums">{formatCurrency(cac)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">{t('cac_description')}</p>
              </div>
            </CardContent>
          </Card>

          {/* LTV - Lifetime Value */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('ltv')}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      className="max-w-[280px] sm:max-w-xs z-50"
                      side="bottom"
                      sideOffset={8}
                      collisionPadding={16}
                      avoidCollisions={true}
                    >
                      <p>{t('ltv_tooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg sm:text-2xl font-bold tabular-nums">{formatCurrency(ltv)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">{t('ltv_description')}</p>
              </div>
            </CardContent>
          </Card>

          {/* LTV/CAC Ratio */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600">
                  <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <Badge variant={ratioStatus.variant} className={ratioStatus.color + ' text-white text-[10px] sm:text-xs'}>
                  {ratioStatus.label}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('ltv_cac_ratio')}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      className="max-w-[280px] sm:max-w-xs z-50"
                      side="bottom"
                      sideOffset={8}
                      collisionPadding={16}
                      avoidCollisions={true}
                    >
                      <p>{t('ratio_tooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg sm:text-2xl font-bold tabular-nums">{ltvCacRatio.toFixed(2)}x</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {ltvCacRatio >= 3
                    ? t('ratio_excellent_desc')
                    : ltvCacRatio >= 2
                    ? t('ratio_good_desc')
                    : ltvCacRatio >= 1
                    ? t('ratio_acceptable_desc')
                    : t('ratio_critical_desc')
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Rate */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">{t('conversion_rate')}</p>
                <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
                  <p className="text-lg sm:text-2xl font-bold tabular-nums">{conversionRate.toFixed(1)}%</p>
                  <span className={`text-[10px] sm:text-xs font-medium ${conversionStatus.color}`}>
                    {conversionStatus.label}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">{t('conversion_description')}</p>
              </div>
            </CardContent>
          </Card>

          {/* ROAS - Return On Ad Spend */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('roas')}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent
                      className="max-w-[280px] sm:max-w-xs z-50"
                      side="bottom"
                      sideOffset={8}
                      collisionPadding={16}
                      avoidCollisions={true}
                    >
                      <p className="mb-2">{t('roas_tooltip')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('ltv_cac_vs_roas')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg sm:text-2xl font-bold tabular-nums">
                  {roas !== null ? `${roas.toFixed(1)}x` : 'N/A'}
                </p>

                {/* Benchmark indicator */}
                {roas !== null && (
                  <div className="mt-2">
                    {roas >= 4 ? (
                      <Badge variant="default" className="gap-1 bg-emerald-500 text-white text-[10px] sm:text-xs">
                        <CheckCircle className="h-3 w-3" />
                        {t('roas_excellent')}
                      </Badge>
                    ) : roas >= 2 ? (
                      <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs">
                        <Info className="h-3 w-3" />
                        {t('roas_good')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 text-[10px] sm:text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        {t('roas_needs_improvement')}
                      </Badge>
                    )}
                  </div>
                )}

                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-1">
                  {t('roas_benchmark')}
                </p>
              </div>
            </CardContent>
          </Card>
      </div>
    </TooltipProvider>
  )
}
