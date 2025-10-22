'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'

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

interface ServiceComparisonProps {
  services: ServiceROIData[]
  loading?: boolean
}

export function ServiceComparison({ services, loading }: ServiceComparisonProps) {
  const t = useTranslations('dashboard.profitability')
  const tCommon = useTranslations('common')

  const [serviceA, setServiceA] = useState<string>('')
  const [serviceB, setServiceB] = useState<string>('')

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-64 animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!services || services.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('compare_services')}</CardTitle>
          <CardDescription>{t('select_two_services')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('need_at_least_two_services')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const selectedA = services.find(s => s.service_id === serviceA)
  const selectedB = services.find(s => s.service_id === serviceB)

  const ComparisonMetric = ({
    label,
    valueA,
    valueB,
    formatter = (v: number) => v.toString(),
    suffix = ''
  }: {
    label: string
    valueA?: number
    valueB?: number
    formatter?: (v: number) => string
    suffix?: string
  }) => {
    if (!valueA || !valueB) return null

    const diff = valueA - valueB
    const diffPercent = valueB !== 0 ? ((diff / valueB) * 100) : 0

    return (
      <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center py-3 border-b last:border-0">
        <div className="text-right">
          <p className="text-lg font-semibold">{formatter(valueA)}{suffix}</p>
        </div>
        <div className="flex flex-col items-center gap-1 min-w-[120px]">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          {diffPercent !== 0 && (
            <Badge
              variant={diff > 0 ? "default" : "secondary"}
              className="gap-1 text-xs"
            >
              {diff > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(diffPercent).toFixed(0)}%
            </Badge>
          )}
        </div>
        <div className="text-left">
          <p className="text-lg font-semibold">{formatter(valueB)}{suffix}</p>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('compare_services')}</CardTitle>
        <CardDescription>{t('select_two_services_to_compare')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service Selectors */}
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
          <Select value={serviceA} onValueChange={setServiceA}>
            <SelectTrigger>
              <SelectValue placeholder={t('select_service_a')} />
            </SelectTrigger>
            <SelectContent>
              {services
                .filter(s => s.service_id !== serviceB)
                .map((service) => (
                  <SelectItem key={service.service_id} value={service.service_id}>
                    {service.service_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <ArrowRight className="h-5 w-5 text-muted-foreground" />

          <Select value={serviceB} onValueChange={setServiceB}>
            <SelectTrigger>
              <SelectValue placeholder={t('select_service_b')} />
            </SelectTrigger>
            <SelectContent>
              {services
                .filter(s => s.service_id !== serviceA)
                .map((service) => (
                  <SelectItem key={service.service_id} value={service.service_id}>
                    {service.service_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Comparison Results */}
        {selectedA && selectedB ? (
          <div className="space-y-0 border rounded-lg p-4">
            {/* Service Names Header */}
            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center pb-4 border-b-2">
              <div className="text-right">
                <p className="font-semibold text-lg">{selectedA.service_name}</p>
                <Badge variant="outline" className="mt-1">
                  {selectedA.category === 'star' && '⭐ Estrella'}
                  {selectedA.category === 'gem' && '💎 Gema'}
                  {selectedA.category === 'volume' && '📦 Volumen'}
                  {selectedA.category === 'review' && '🔍 Revisar'}
                </Badge>
              </div>
              <div className="w-[120px]" />
              <div className="text-left">
                <p className="font-semibold text-lg">{selectedB.service_name}</p>
                <Badge variant="outline" className="mt-1">
                  {selectedB.category === 'star' && '⭐ Estrella'}
                  {selectedB.category === 'gem' && '💎 Gema'}
                  {selectedB.category === 'volume' && '📦 Volumen'}
                  {selectedB.category === 'review' && '🔍 Revisar'}
                </Badge>
              </div>
            </div>

            {/* Metrics Comparison */}
            <div className="pt-4">
              <ComparisonMetric
                label="ROI"
                valueA={selectedA.roi_percentage}
                valueB={selectedB.roi_percentage}
                formatter={(v) => v.toFixed(0)}
                suffix="%"
              />
              <ComparisonMetric
                label={t('profit_margin')}
                valueA={selectedA.total_profit_cents / selectedA.total_revenue_cents * 100}
                valueB={selectedB.total_profit_cents / selectedB.total_revenue_cents * 100}
                formatter={(v) => v.toFixed(1)}
                suffix="%"
              />
              <ComparisonMetric
                label={t('frequency')}
                valueA={selectedA.total_sales}
                valueB={selectedB.total_sales}
                formatter={(v) => v.toString()}
              />
              <ComparisonMetric
                label={t('total_revenue')}
                valueA={selectedA.total_revenue_cents}
                valueB={selectedB.total_revenue_cents}
                formatter={(v) => formatCurrency(v).replace('MXN', '').trim()}
              />
              <ComparisonMetric
                label={t('profit_per_hour')}
                valueA={selectedA.profit_per_hour_cents}
                valueB={selectedB.profit_per_hour_cents}
                formatter={(v) => formatCurrency(v).replace('MXN', '').trim()}
              />
              <ComparisonMetric
                label={t('avg_profit_per_sale')}
                valueA={selectedA.avg_profit_per_sale_cents}
                valueB={selectedB.avg_profit_per_sale_cents}
                formatter={(v) => formatCurrency(v).replace('MXN', '').trim()}
              />
            </div>

            {/* Winner Summary */}
            <div className="mt-6 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {selectedA.roi_percentage > selectedB.roi_percentage ? (
                  <>
                    <span className="font-semibold text-foreground">{selectedA.service_name}</span> {t('has_better_roi')}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{selectedB.service_name}</span> {t('has_better_roi')}
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {t('select_both_services_to_compare')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
