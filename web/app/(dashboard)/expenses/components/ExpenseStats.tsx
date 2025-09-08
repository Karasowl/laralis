'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { SummaryCards } from '@/components/ui/summary-cards'
import { DollarSign, Receipt, Target, AlertTriangle } from 'lucide-react'
import { formatMoney } from '@/lib/money'

interface ExpenseStatsData {
  total_amount: number
  total_count: number
  by_category: Array<{
    category: string
    amount: number
    count: number
    percentage: number
  }>
  vs_fixed_costs: {
    planned: number
    actual: number
    variance: number
    variance_percentage: number
  }
  by_month: Array<{
    month: string
    amount: number
    count: number
  }>
}

interface ExpenseStatsProps {
  stats: ExpenseStatsData | null
  t: (key: string) => string
}

export function ExpenseStats({ stats, t }: ExpenseStatsProps) {
  const tg = useTranslations()
  const summary = useMemo(() => {
    if (!stats) return null
    
    const variancePercentage = Math.abs(stats.vs_fixed_costs.variance_percentage)
    const isOverBudget = stats.vs_fixed_costs.variance > 0
    
    return {
      totalAmount: stats.total_amount,
      totalCount: stats.total_count,
      variancePercentage,
      isOverBudget,
      topCategory: stats.by_category[0]?.category || '-',
      topCategoryPercentage: stats.by_category[0]?.percentage || 0
    }
  }, [stats])

  if (!summary || !stats) return null

  return (
    <SummaryCards
      cards={[
        {
          label: t('total_expenses'),
          value: formatMoney(summary.totalAmount),
          subtitle: `${summary.totalCount} ${tg('expenses.title')}`,
          icon: DollarSign,
          color: 'primary'
        },
        {
          label: t('total_transactions'),
          value: summary.totalCount,
          subtitle: t('this_period'),
          icon: Receipt,
          color: 'success'
        },
        {
          label: t('vs_budget'),
          value: `${summary.isOverBudget ? '+' : ''}${summary.variancePercentage}%`,
          subtitle: `${summary.isOverBudget ? '+' : ''}${formatMoney(Math.abs(stats.vs_fixed_costs.variance))}`,
          icon: Target,
          color: summary.isOverBudget ? 'danger' : 'success'
        },
        {
          label: t('top_category'),
          value: summary.topCategory,
          subtitle: `${summary.topCategoryPercentage}%`,
          icon: AlertTriangle,
          color: 'info'
        },
      ]}
      columns={4}
    />
  )
}
