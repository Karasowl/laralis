'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/money'
import { DollarSign, TrendingUp, Target, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface MarketingMetricsProps {
  cac: number // Customer Acquisition Cost in cents
  ltv: number // Lifetime Value in cents
  conversionRate: number // Percentage 0-100
  loading?: boolean
}

export function MarketingMetrics({ cac, ltv, conversionRate, loading }: MarketingMetricsProps) {
  const t = useTranslations('dashboard.marketing')
  const tCommon = useTranslations('common')

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-24 animate-pulse mb-2" />
              <div className="h-8 bg-muted rounded w-32 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Calculate LTV/CAC ratio
  const ltvCacRatio = cac > 0 ? ltv / cac : 0

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
    <div className="grid gap-4 md:grid-cols-4">
        {/* CAC - Customer Acquisition Cost */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('cac')}</p>
              <p className="text-2xl font-bold">{formatCurrency(cac)}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('cac_description')}</p>
            </div>
          </CardContent>
        </Card>

        {/* LTV - Lifetime Value */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('ltv')}</p>
              <p className="text-2xl font-bold">{formatCurrency(ltv)}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('ltv_description')}</p>
            </div>
          </CardContent>
        </Card>

        {/* LTV/CAC Ratio */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600">
                <Target className="h-4 w-4 text-white" />
              </div>
              <Badge variant={ratioStatus.variant} className={ratioStatus.color + ' text-white'}>
                {ratioStatus.label}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('ltv_cac_ratio')}</p>
              <p className="text-2xl font-bold">{ltvCacRatio.toFixed(2)}x</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
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
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600">
                <Users className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('conversion_rate')}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p>
                <span className={`text-xs font-medium ${conversionStatus.color}`}>
                  {conversionStatus.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t('conversion_description')}</p>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
