'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/money'
import { Undo2, TrendingDown, Percent, AlertTriangle } from 'lucide-react'

interface RefundData {
  refund_count: number
  total_treatments: number
  refund_rate: number
  total_loss_cents: number
  material_loss_cents: number
  time_loss_cents: number
  avg_loss_per_refund_cents: number
  total_original_price_cents: number
  monthly_trend: Array<{
    month: string
    count: number
    loss_cents: number
  }>
}

interface RefundStatsProps {
  dateFrom?: string
  dateTo?: string
  compact?: boolean
}

export function RefundStats({ dateFrom, dateTo, compact = false }: RefundStatsProps) {
  const t = useTranslations('treatments.refund.stats')
  const [data, setData] = useState<RefundData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (dateFrom) params.set('from', dateFrom)
        if (dateTo) params.set('to', dateTo)

        const url = `/api/analytics/refunds${params.toString() ? `?${params.toString()}` : ''}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error('Failed to fetch refund statistics')
        }

        const result = await response.json()
        setData(result.data)
      } catch (err) {
        console.error('Error fetching refund stats:', err)
        setError('Error loading refund statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [dateFrom, dateTo])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.refund_count === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-muted-foreground" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noRefunds')}</p>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    // Compact version for dashboard summary
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Undo2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('totalRefunded')}</p>
                <p className="text-lg font-semibold">{data.refund_count}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t('totalLoss')}</p>
              <p className="text-lg font-semibold text-destructive">
                -{formatCurrency(data.total_loss_cents)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Full version with detailed breakdown
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Undo2 className="h-4 w-4 text-orange-600" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('totalRefunded')}</p>
            <p className="text-2xl font-bold">{data.refund_count}</p>
            <p className="text-xs text-muted-foreground">
              de {data.total_treatments} tratamientos
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('refundRate')}</p>
            <div className="flex items-center gap-1">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <p className="text-2xl font-bold">{data.refund_rate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Loss breakdown */}
        <div className="border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">{t('lossBreakdown')}</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">{t('totalLoss')}</span>
              <span className="text-sm font-semibold text-destructive">
                -{formatCurrency(data.total_loss_cents)}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs">{t('materialLoss')}</span>
              <span className="text-xs">-{formatCurrency(data.material_loss_cents)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs">{t('timeLoss')}</span>
              <span className="text-xs">-{formatCurrency(data.time_loss_cents)}</span>
            </div>
          </div>
        </div>

        {/* Average loss */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('avgLossPerRefund')}</span>
            <span className="text-sm font-medium">
              -{formatCurrency(data.avg_loss_per_refund_cents)}
            </span>
          </div>
        </div>

        {/* Trend visualization */}
        {data.monthly_trend.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">{t('refundTrend')}</p>
            <div className="flex items-end gap-1 h-12">
              {data.monthly_trend.map((month, idx) => {
                const maxCount = Math.max(...data.monthly_trend.map(m => m.count))
                const height = maxCount > 0 ? (month.count / maxCount) * 100 : 0
                return (
                  <div
                    key={month.month}
                    className="flex-1 bg-orange-200 dark:bg-orange-800 rounded-t"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${month.month}: ${month.count} reembolsos`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{data.monthly_trend[0]?.month?.slice(5)}</span>
              <span>{data.monthly_trend[data.monthly_trend.length - 1]?.month?.slice(5)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
