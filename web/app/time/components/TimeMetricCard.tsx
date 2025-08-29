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
    default: 'bg-gray-50',
    primary: 'bg-blue-50',
    success: 'bg-green-50'
  }

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}