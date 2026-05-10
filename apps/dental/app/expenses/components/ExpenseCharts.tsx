'use client'

import { TrendingUp, CalendarRange } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/money'

interface CategoryBreakdown {
  category: string
  amount: number
  count: number
  percentage: number
}

interface MonthlyBreakdown {
  month: string
  amount: number
  count: number
}

interface ExpenseChartsProps {
  categoryBreakdown: CategoryBreakdown[]
  monthlyBreakdown: MonthlyBreakdown[]
  getCategoryLabel: (value?: string | null) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: any) => string
}

export function ExpenseCharts({
  categoryBreakdown,
  monthlyBreakdown,
  getCategoryLabel,
  t,
}: ExpenseChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('charts.byCategory.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('charts.byCategory.empty')}</p>
          ) : (
            categoryBreakdown.map((category) => (
              <div key={category.category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{getCategoryLabel(category.category)}</span>
                  <span className="font-semibold">{formatCurrency(category.amount)}</span>
                </div>
                <Progress value={category.percentage} />
                <p className="text-xs text-muted-foreground">
                  {t('charts.byCategory.transactions', { count: category.count })}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            {t('charts.byMonth.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {monthlyBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('charts.byMonth.empty')}</p>
          ) : (
            monthlyBreakdown.map((month) => (
              <div key={month.month} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{month.month}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('charts.byMonth.transactions', { count: month.count })}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(month.amount)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
