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
        <CardTitle>{t('fixed_costs_breakdown')}</CardTitle>
        <CardDescription>{t('monthly_fixed_costs')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {costs.map(cost => (
            <div key={cost.id} className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{cost.name}</p>
                <p className="text-xs text-muted-foreground">{cost.category}</p>
              </div>
              <span className="font-medium">{formatCurrency(cost.amount_cents)}</span>
            </div>
          ))}
          
          {depreciation > 0 && (
            <div className="flex justify-between items-center pt-2 border-t">
              <div>
                <p className="text-sm font-medium">{t('assets_depreciation')}</p>
                <p className="text-xs text-muted-foreground">{t('monthly')}</p>
              </div>
              <span className="font-medium">{formatCurrency(depreciation)}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center pt-3 border-t">
            <p className="font-semibold">{t('total_fixed_costs')}</p>
            <span className="font-bold text-lg">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}