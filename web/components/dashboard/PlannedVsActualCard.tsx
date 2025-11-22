'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PlannedVsActualData, CategoryVariance } from '@/hooks/use-planned-vs-actual'

interface PlannedVsActualCardProps {
  data: PlannedVsActualData
}

export function PlannedVsActualCard({ data }: PlannedVsActualCardProps) {
  const t = useTranslations('dashboard')

  const isOverBudget = data.total_variance_cents > 0
  const isUnderBudget = data.total_variance_cents < 0
  const isOnTrack = data.total_variance_cents === 0

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600 dark:text-red-400'
    if (variance < 0) return 'text-emerald-600 dark:text-emerald-400'
    return 'text-muted-foreground'
  }

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return TrendingUp
    if (variance < 0) return TrendingDown
    return Info
  }

  const getStatusIcon = () => {
    if (isOnTrack) return CheckCircle2
    if (isOverBudget) return AlertTriangle
    return CheckCircle2
  }

  const StatusIcon = getStatusIcon()

  const actualPercentage = data.total_planned_cents > 0
    ? Math.min((data.total_actual_cents / data.total_planned_cents) * 100, 100)
    : 0

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <StatusIcon className={cn(
                'h-5 w-5',
                isOverBudget && 'text-amber-600',
                isUnderBudget && 'text-emerald-600',
                isOnTrack && 'text-muted-foreground'
              )} />
              Planeado vs Real
            </CardTitle>
            <CardDescription>
              Costos fijos: presupuesto vs gastos reales
            </CardDescription>
          </div>
          <Badge variant={isOverBudget ? 'destructive' : 'default'} className="gap-1">
            {data.total_variance_pct > 0 ? '+' : ''}
            {data.total_variance_pct.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Total Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Planeado (mensual)</span>
            <span className="font-medium">{formatCurrency(data.total_planned_cents)}</span>
          </div>

          <Progress
            value={actualPercentage}
            className={cn(
              'h-2',
              isOverBudget && '[&>div]:bg-red-600',
              isUnderBudget && '[&>div]:bg-emerald-600'
            )}
          />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Real (período)</span>
            <span className={cn('font-semibold', getVarianceColor(data.total_variance_cents))}>
              {formatCurrency(data.total_actual_cents)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm font-medium">Varianza</span>
            <span className={cn('font-bold text-base', getVarianceColor(data.total_variance_cents))}>
              {data.total_variance_cents > 0 ? '+' : ''}
              {formatCurrency(data.total_variance_cents)}
            </span>
          </div>
        </div>

        {/* Insight Alert */}
        <Alert variant={isOverBudget ? 'destructive' : 'default'}>
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">
            {isOverBudget && 'Gasto mayor a lo planeado'}
            {isUnderBudget && 'Gasto menor a lo planeado'}
            {isOnTrack && 'En línea con lo planeado'}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {data.metadata.insight}
          </AlertDescription>
        </Alert>

        {/* Category Breakdown - Top 5 */}
        {data.category_breakdown.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Varianza por categoría
            </h4>
            <div className="space-y-2">
              {data.category_breakdown.slice(0, 5).map((category) => {
                const VarianceIcon = getVarianceIcon(category.variance_cents)
                return (
                  <div
                    key={category.category}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <VarianceIcon className={cn('h-3 w-3 flex-shrink-0', getVarianceColor(category.variance_cents))} />
                      <span className="text-sm truncate">{category.category}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(category.planned_cents)}
                      </span>
                      <span className="text-xs">→</span>
                      <span className={cn('text-sm font-medium', getVarianceColor(category.variance_cents))}>
                        {formatCurrency(category.actual_cents)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {data.category_breakdown.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No hay datos de costos planeados o gastos reales para comparar
          </div>
        )}
      </CardContent>
    </Card>
  )
}
