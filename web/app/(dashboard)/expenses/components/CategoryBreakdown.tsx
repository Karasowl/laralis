'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/money'

interface CategoryData {
  category: string
  amount: number
  count: number
  percentage: number
}

interface CategoryBreakdownProps {
  categories: CategoryData[]
  t: (key: string) => string
}

import { useTranslations } from 'next-intl'

export function CategoryBreakdown({ categories, t }: CategoryBreakdownProps) {
  const tg = useTranslations()
  if (!categories || categories.length === 0) return null
  
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">{t('category_breakdown')}</h3>
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.category} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{category.category}</Badge>
                <span className="text-sm text-muted-foreground">
                  {category.count} {tg('expenses.title')}
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
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${category.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
