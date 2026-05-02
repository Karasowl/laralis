'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { useTranslations } from 'next-intl'

interface CostBreakdownProps {
  costs: Array<{ id: string; name: string; amount_cents: number; category: string }>
  depreciation: number
  total: number
}

export function CostBreakdown({ costs, depreciation, total }: CostBreakdownProps) {
  const t = useTranslations('time')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{t('fixed_costs_breakdown')}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{t('monthly_fixed_costs')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 sm:space-y-3">
          {costs.map(cost => (
            <div key={cost.id} className="flex justify-between items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium truncate">{cost.name}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{cost.category}</p>
              </div>
              <span className="text-sm sm:text-base font-medium tabular-nums shrink-0">{formatCurrency(cost.amount_cents)}</span>
            </div>
          ))}

          {depreciation > 0 && (
            <div className="flex justify-between items-center gap-2 pt-2 border-t">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium">{t('assets_depreciation')}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('monthly')}</p>
              </div>
              <span className="text-sm sm:text-base font-medium tabular-nums shrink-0">{formatCurrency(depreciation)}</span>
            </div>
          )}

          <div className="flex justify-between items-center gap-2 pt-3 border-t">
            <p className="text-sm sm:text-base font-semibold">{t('total_fixed_costs')}</p>
            <span className="text-base sm:text-lg font-bold tabular-nums shrink-0">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}