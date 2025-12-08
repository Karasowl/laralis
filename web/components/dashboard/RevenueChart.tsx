'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RevenueChartProps {
  data: Array<{
    month: string
    revenue: number
    expenses: number
  }>
  title?: string
  description?: string
  onGranularityChange?: (granularity: 'day' | 'week' | 'biweek' | 'month') => void
  currentGranularity?: 'day' | 'week' | 'biweek' | 'month'
}

export function RevenueChart({
  data,
  title = 'Revenue vs Expenses',
  description = 'Monthly comparison',
  onGranularityChange,
  currentGranularity = 'month'
}: RevenueChartProps) {
  const t = useTranslations('dashboard')

  const granularityOptions = [
    { value: 'day' as const, label: t('day') || 'Día' },
    { value: 'week' as const, label: t('week') || 'Semana' },
    { value: 'biweek' as const, label: 'Quincena' },
    { value: 'month' as const, label: t('month') || 'Mes' },
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 dark:bg-background/95 backdrop-blur-xl p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-lg">
      <CardHeader className="pb-2 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
          </div>
          {onGranularityChange && (
            <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
              {granularityOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={currentGranularity === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onGranularityChange(option.value)}
                  className={cn(
                    'text-[10px] sm:text-xs px-2 py-1 h-6 sm:h-7 flex-shrink-0',
                    currentGranularity === option.value && 'font-semibold'
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200} className="sm:!h-[260px] lg:!h-[300px]">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              tickFormatter={(value: number) => {
                if (Math.abs(value) >= 1000) {
                  return `$${(value / 1000).toFixed(0)}k`
                }
                return `$${value.toFixed(0)}`
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(221, 83%, 53%)"
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name={t('chart_revenue')}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="hsl(0, 84%, 60%)"
              fillOpacity={1}
              fill="url(#colorExpenses)"
              name={t('chart_expenses')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
