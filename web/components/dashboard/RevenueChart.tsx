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
        <div className="bg-white dark:bg-gray-800 p-3 border border-border rounded-lg shadow-lg">
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {onGranularityChange && (
            <div className="flex gap-1">
              {granularityOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={currentGranularity === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onGranularityChange(option.value)}
                  className={cn(
                    'text-xs px-2 py-1 h-7',
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
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
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
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name={t('chart_revenue')}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#EF4444"
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
