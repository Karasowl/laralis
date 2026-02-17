'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, DollarSign, Receipt, Target, AlertTriangle } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { type ExpenseStats } from '@/lib/types/expenses'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { useApi } from '@/hooks/use-api'
import { cn, getLocalDateISO } from '@/lib/utils'

interface ExpenseStatsProps {
  detailed?: boolean
}

export default function ExpenseStats({ detailed = false }: ExpenseStatsProps) {
  const t = useTranslations('expenses')
  const tRoot = useTranslations()
  const { currentClinic } = useCurrentClinic()
  const [dateRange] = useState({
    start_date: getLocalDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end_date: getLocalDateISO()
  })

  const statsEndpoint = useMemo(() => {
    if (!currentClinic?.id) return null
    const params = new URLSearchParams({
      clinic_id: currentClinic.id,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date,
    })
    return `/api/expenses/stats?${params.toString()}`
  }, [currentClinic?.id, dateRange.end_date, dateRange.start_date])

  const { data, loading } = useApi<{ data: ExpenseStats }>(statsEndpoint, {
    autoFetch: !!statsEndpoint,
  })
  const stats = data?.data ?? null

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<DollarSign className="h-8 w-8" />}
          title={t('no_stats_available')}
          description="Las estadísticas aparecerán aquí cuando registres gastos"
        />
      </Card>
    )
  }

  const variancePercentage = Math.abs(stats.vs_fixed_costs.variance_percentage)
  const isOverBudget = stats.vs_fixed_costs.variance > 0

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Amount */}
        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="ml-2 text-sm font-medium">{t('total_expenses')}</span>
          </div>
          <div className="text-2xl font-bold">{formatMoney(stats.total_amount)}</div>
          <p className="text-xs text-muted-foreground">
            {stats.total_count} {tRoot('expenses.title')}
          </p>
        </Card>

        {/* Total Count */}
        <Card className="p-6">
          <div className="flex items-center">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="ml-2 text-sm font-medium">{t('total_transactions')}</span>
          </div>
          <div className="text-2xl font-bold">{stats.total_count}</div>
          <p className="text-xs text-muted-foreground">
            {t('this_period')}
          </p>
        </Card>

        {/* Budget Comparison */}
        <Card className="p-6">
          <div className="flex items-center">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="ml-2 text-sm font-medium">{t('vs_budget')}</span>
          </div>
          <div className={cn(
            "text-2xl font-bold",
            isOverBudget ? "text-destructive" : "text-green-600"
          )}>
            {isOverBudget ? "+" : ""}{variancePercentage}%
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            {isOverBudget ? (
              <TrendingUp className="h-3 w-3 mr-1 text-destructive" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1 text-green-600" />
            )}
            {formatMoney(Math.abs(stats.vs_fixed_costs.variance))}
          </div>
        </Card>

        {/* Top Category */}
        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="ml-2 text-sm font-medium">{t('top_category')}</span>
          </div>
          <div className="text-2xl font-bold">
            {stats.by_category[0]?.category || '-'}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.by_category[0] ? `${stats.by_category[0].percentage}%` : ''}
          </p>
        </Card>
      </div>

      {detailed && (
        <>
          {/* Category Breakdown */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('category_breakdown')}</h3>
            <div className="space-y-4">
              {stats.by_category.map((category) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{category.category}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {category.count} {tRoot('expenses.title')}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">
                        {formatMoney(category.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {category.percentage}%
                      </div>
                    </div>
                  </div>
                  <Progress 
                    value={category.percentage} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Budget Comparison Detail */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('budget_comparison')}</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">{t('planned')}</div>
                <div className="text-xl font-bold">
                  {formatMoney(stats.vs_fixed_costs.planned)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">{t('actual')}</div>
                <div className="text-xl font-bold">
                  {formatMoney(stats.vs_fixed_costs.actual)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">{t('variance')}</div>
                <div className={cn(
                  "text-xl font-bold",
                  isOverBudget ? "text-destructive" : "text-green-600"
                )}>
                  {isOverBudget ? "+" : ""}{formatMoney(Math.abs(stats.vs_fixed_costs.variance))}
                </div>
              </div>
            </div>
          </Card>

          {/* Monthly Trends */}
          {stats.by_month.length > 1 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t('monthly_trends')}</h3>
              <div className="space-y-4">
                {stats.by_month.map((month) => (
                  <div key={month.month} className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {new Date(month.month + '-01').toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'long'
                      })}
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">
                        {formatMoney(month.amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {month.count} {tRoot('expenses.title')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
