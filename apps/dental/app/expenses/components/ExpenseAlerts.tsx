'use client'

import { TrendingUp, ShoppingCart, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/money'

type BudgetAlertSeverity = 'high' | 'medium' | 'low'

interface BudgetAlert {
  message: string
  severity: BudgetAlertSeverity
  details: {
    planned: number
    actual: number
    variance: number
    percentage: number
  }
}

interface LowStockItem {
  id: string
  name: string
  stock_quantity: number
  min_stock_alert: number
  category: string
}

interface PriceChangeItem {
  id: string
  name: string
  price_change_percentage: number
  price_per_portion_cents: number
  last_purchase_price_cents: number
}

interface AlertsData {
  budget_alerts: BudgetAlert[]
  low_stock: LowStockItem[]
  price_changes: PriceChangeItem[]
  summary: {
    total_alerts: number
    by_severity: {
      high: number
      medium: number
      low: number
    }
  }
}

interface ExpenseAlertsProps {
  alerts: AlertsData | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

function severityBadgeClass(severity: BudgetAlertSeverity): string {
  if (severity === 'high') return 'border-red-300 text-destructive bg-destructive/10'
  if (severity === 'medium') return 'border-amber-300 text-amber-700 bg-amber-50'
  return 'border-green-300 text-green-700 bg-green-50'
}

export function ExpenseAlertsCard({ alerts, t }: ExpenseAlertsProps) {
  const renderAlerts = () => {
    if (!alerts || alerts.summary.total_alerts === 0) {
      return <p className="text-sm text-muted-foreground">{t('alerts.empty')}</p>
    }

    return (
      <div className="space-y-4">
        {alerts.budget_alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              {t('alerts.budgetTitle')}
            </h4>
            <div className="space-y-2">
              {alerts.budget_alerts.map((alert, index) => (
                <div key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-amber-900">{alert.message}</p>
                    <Badge variant="outline" className={severityBadgeClass(alert.severity)}>
                      {t(`alerts.severity.${alert.severity}`)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-amber-900/80">
                    <div>
                      {t('alerts.budgetPlanned')}: {formatCurrency(alert.details.planned)}
                    </div>
                    <div>
                      {t('alerts.budgetActual')}: {formatCurrency(alert.details.actual)}
                    </div>
                    <div>
                      {t('alerts.budgetVariance')}: {formatCurrency(alert.details.variance)} (
                      {alert.details.percentage}%)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.low_stock.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-destructive" />
              {t('alerts.lowStockTitle')}
            </h4>
            <div className="space-y-2">
              {alerts.low_stock.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-destructive">{item.name}</p>
                    <p className="text-xs text-destructive">
                      {t('alerts.lowStockIndicator', {
                        current: item.stock_quantity,
                        minimum: item.min_stock_alert,
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-red-300 text-destructive">
                    {item.category}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.price_changes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              {t('alerts.priceChangesTitle')}
            </h4>
            <div className="space-y-2">
              {alerts.price_changes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-primary/30 bg-primary/10 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-primary/95">{item.name}</p>
                    <p className="text-xs text-primary">
                      {item.price_change_percentage > 0
                        ? t('alerts.priceChangeUp', { value: item.price_change_percentage })
                        : t('alerts.priceChangeDown', { value: Math.abs(item.price_change_percentage) })}
                    </p>
                  </div>
                  <div className="text-xs text-primary">
                    <div>
                      {formatCurrency(item.price_per_portion_cents)} →{' '}
                      {formatCurrency(item.last_purchase_price_cents)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {t('alerts.summaryTitle', {
              total: alerts.summary.total_alerts,
              high: alerts.summary.by_severity.high,
              medium: alerts.summary.by_severity.medium,
              low: alerts.summary.by_severity.low,
            })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {t('alerts.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>{renderAlerts()}</CardContent>
    </Card>
  )
}
