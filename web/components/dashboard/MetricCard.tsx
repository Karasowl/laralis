'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUp, ArrowDown, LucideIcon } from 'lucide-react'

export interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
  icon: LucideIcon
  color?: string
  subtitle?: string
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  color = 'text-blue-600',
  subtitle
}: MetricCardProps) {
  const getChangeColor = () => {
    if (changeType === 'increase') return 'text-green-600'
    if (changeType === 'decrease') return 'text-red-600'
    return 'text-gray-600'
  }

  const getChangeIcon = () => {
    if (changeType === 'increase') return ArrowUp
    if (changeType === 'decrease') return ArrowDown
    return null
  }

  const ChangeIcon = getChangeIcon()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-opacity-10 ${color}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {change !== undefined && (
          <div className={`flex items-center mt-2 text-xs ${getChangeColor()}`}>
            {ChangeIcon && <ChangeIcon className="h-3 w-3 mr-1" />}
            <span>{Math.abs(change)}%</span>
            <span className="text-muted-foreground ml-1">vs mes anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}