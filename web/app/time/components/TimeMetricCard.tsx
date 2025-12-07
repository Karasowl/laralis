'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TimeMetricCardProps {
  icon: any
  title: string
  value: string | number
  subtitle?: string
  variant?: 'default' | 'primary' | 'success'
}

export function TimeMetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  variant = 'default'
}: TimeMetricCardProps) {
  const variantStyles = {
    default: 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800',
    primary: 'bg-primary/10 dark:bg-primary/20/30 border-primary/30 dark:border-blue-900/50',
    success: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50'
  }

  return (
    <Card className={`${variantStyles[variant]} transition-colors`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-foreground">{title}</CardTitle>
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{value}</div>
        {subtitle && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}