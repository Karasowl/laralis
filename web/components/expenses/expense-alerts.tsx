'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  AlertTriangle, 
  TrendingUp, 
  Package, 
  DollarSign,
  ChevronRight,
  Bell,
  X
} from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { type LowStockAlert } from '@/lib/types/expenses'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

interface ExpenseAlertsData {
  low_stock: LowStockAlert[]
  price_changes: Array<{
    id: string
    name: string
    category: string
    price_per_portion_cents: number
    last_purchase_price_cents: number
    price_change_percentage: number
  }>
  budget_alerts: Array<{
    type: string
    message: string
    severity: 'high' | 'medium' | 'low'
    details: {
      planned: number
      actual: number
      variance: number
      percentage: number
    }
  }>
  summary: {
    total_alerts: number
    by_severity: {
      high: number
      medium: number
      low: number
    }
  }
}

export default function ExpenseAlerts() {
  const t = useTranslations('expenses')
  const { currentClinic } = useCurrentClinic()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const alertsEndpoint = useMemo(() => {
    if (!currentClinic?.id) return null
    return `/api/expenses/alerts?clinic_id=${currentClinic.id}`
  }, [currentClinic?.id])

  const { data, loading } = useApi<{ data: ExpenseAlertsData }>(alertsEndpoint, {
    autoFetch: !!alertsEndpoint,
  })
  const alerts = data?.data ?? null

  const dismissAlert = (alertId: string) => {
    setDismissed(prev => new Set(Array.from(prev).concat(alertId)))
  }

  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  if (!alerts || alerts.summary.total_alerts === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title={t('no_alerts')}
          description={t('all_systems_normal')}
        />
      </Card>
    )
  }

  const getSeverityColor = (severity: 'high' | 'medium' | 'low'): 'destructive' | 'default' => {
    switch (severity) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
        return 'default'
      default:
        return 'default'
    }
  }

  const getSeverityIcon = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <TrendingUp className="h-4 w-4" />
      case 'low':
        return <Package className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">{t('alerts_title')}</h2>
          <Badge variant="outline">
            {alerts.summary.total_alerts}
          </Badge>
        </div>
        
        <div className="flex gap-2">
          {alerts.summary.by_severity.high > 0 && (
            <Badge variant="destructive" className="text-xs">
              {alerts.summary.by_severity.high} {t('high')}
            </Badge>
          )}
          {alerts.summary.by_severity.medium > 0 && (
            <Badge variant="default" className="text-xs">
              {alerts.summary.by_severity.medium} {t('medium')}
            </Badge>
          )}
          {alerts.summary.by_severity.low > 0 && (
            <Badge variant="secondary" className="text-xs">
              {alerts.summary.by_severity.low} {t('low')}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Budget Alerts */}
        {alerts.budget_alerts.map((alert, index) => {
          const alertId = `budget-${index}`
          if (dismissed.has(alertId)) return null

          return (
            <Alert key={alertId} variant={getSeverityColor(alert.severity)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="space-y-1">
                    <AlertTitle className="text-sm font-medium">
                      {t('budget_exceeded')}
                    </AlertTitle>
                    <AlertDescription className="text-sm">
                      {alert.message}
                    </AlertDescription>
                    <div className="text-xs text-muted-foreground mt-2">
                      {t('planned')}: {formatMoney(alert.details.planned)} | 
                      {t('actual')}: {formatMoney(alert.details.actual)} | 
                      {t('variance')}: +{formatMoney(alert.details.variance)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alertId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          )
        })}

        {/* Low Stock Alerts */}
        {alerts.low_stock.slice(0, 3).map((stock) => {
          const alertId = `stock-${stock.id}`
          if (dismissed.has(alertId)) return null

          const severity = stock.stock_quantity === 0 ? 'high' : 'medium'

          return (
            <Alert key={alertId} variant={getSeverityColor(severity)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Package className="h-4 w-4" />
                  <div className="space-y-1">
                    <AlertTitle className="text-sm font-medium">
                      {stock.stock_quantity === 0 ? t('out_of_stock') : t('low_stock')}
                    </AlertTitle>
                    <AlertDescription className="text-sm">
                      <span className="font-medium">{stock.name}</span> 
                      {stock.stock_quantity === 0 
                        ? ` ${t('is_out_of_stock')}`
                        : ` ${t('has_low_stock')}: ${stock.stock_quantity} ${t('units_remaining')}`
                      }
                    </AlertDescription>
                    <div className="text-xs text-muted-foreground">
                      {t('category')}: {stock.category} | 
                      {t('minimum')}: {stock.min_stock_alert}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alertId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          )
        })}

        {/* Price Change Alerts */}
        {alerts.price_changes.slice(0, 2).map((priceChange) => {
          const alertId = `price-${priceChange.id}`
          if (dismissed.has(alertId)) return null

          return (
            <Alert key={alertId} variant="default">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4" />
                  <div className="space-y-1">
                    <AlertTitle className="text-sm font-medium">
                      {t('price_change')}
                    </AlertTitle>
                    <AlertDescription className="text-sm">
                      <span className="font-medium">{priceChange.name}</span> {t('price_changed_by')} 
                      <span className={cn(
                        "font-medium ml-1",
                        priceChange.price_change_percentage > 0 ? "text-destructive" : "text-green-600"
                      )}>
                        {priceChange.price_change_percentage > 0 ? "+" : ""}{priceChange.price_change_percentage}%
                      </span>
                    </AlertDescription>
                    <div className="text-xs text-muted-foreground">
                      {t('previous')}: {formatMoney(priceChange.price_per_portion_cents)} | 
                      {t('current')}: {formatMoney(priceChange.last_purchase_price_cents)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alertId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Alert>
          )
        })}

        {/* Show More Button */}
        {(alerts.low_stock.length > 3 || alerts.price_changes.length > 2) && (
          <div className="text-center pt-4">
            <Button variant="outline" size="sm">
              {t('view_all_alerts')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
