'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency } from '@/lib/format'
import { formatDistanceToNow } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { User, Package, DollarSign, Calendar, Activity } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'

export interface ActivityItem {
  id: string
  type: 'treatment' | 'patient' | 'expense' | 'appointment' | 'supply'
  title: string
  description?: string
  amount?: number
  timestamp: Date
  user?: string
}

interface RecentActivityProps {
  activities: ActivityItem[]
  title?: string
  description?: string
}

export function RecentActivity({
  activities,
  title,
  description
}: RecentActivityProps) {
  const t = useTranslations('dashboardComponents.recentActivity')
  const locale = useLocale()
  const dateLocale = locale === 'es' ? es : enUS

  const safeFormatDistance = (value: Date | string | number) => {
    try {
      const d = value instanceof Date ? value : new Date(value)
      if (isNaN(d.getTime())) return t('justNow')
      return formatDistanceToNow(d, { addSuffix: true, locale: dateLocale })
    } catch {
      return t('justNow')
    }
  }
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'treatment': return Activity
      case 'patient': return User
      case 'expense': return DollarSign
      case 'appointment': return Calendar
      case 'supply': return Package
      default: return Activity
    }
  }

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'treatment': return 'bg-primary/10 text-primary dark:bg-primary/20 backdrop-blur-sm'
      case 'patient': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-500 backdrop-blur-sm'
      case 'expense': return 'bg-destructive/10 text-destructive dark:bg-destructive/20 backdrop-blur-sm'
      case 'appointment': return 'bg-secondary/10 text-secondary dark:bg-secondary/20 backdrop-blur-sm'
      case 'supply': return 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 backdrop-blur-sm'
      default: return 'bg-muted text-muted-foreground backdrop-blur-sm'
    }
  }

  return (
    <Card className="transition-all duration-200 hover:shadow-lg">
      <CardHeader>
        <CardTitle>{title || t('title')}</CardTitle>
        <CardDescription>{description || t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('noActivity')}
            </p>
          ) : (
            activities.map((activity) => {
              const Icon = getActivityIcon(activity.type)
              const colorClass = getActivityColor(activity.type)
              
              return (
                <div key={activity.id} className="flex items-start space-x-3 p-2 -mx-2 rounded-lg transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
                  <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {(activity.amount ?? null) !== null && (
                        <span className="text-sm font-medium">
                          {formatCurrency(activity.amount!)}
                        </span>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground">
                        {activity.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {safeFormatDistance(activity.timestamp)}
                      </span>
                      {activity.user && (
                        <>
                          <span>•</span>
                          <span>{activity.user}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
