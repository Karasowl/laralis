'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, TrendingUp, Megaphone, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface MarketingEvent {
  id: string
  name: string
  type: 'campaign_start' | 'campaign_end' | 'promotion' | 'event'
  date: string // YYYY-MM-DD
  campaignId?: string
}

export interface RevenueDataPoint {
  date: string // YYYY-MM-DD
  revenueCents: number
}

interface MarketingTimelineProps {
  events: MarketingEvent[]
  revenueData: RevenueDataPoint[]
  title?: string
  description?: string
}

export function MarketingTimeline({
  events,
  revenueData,
  title,
  description
}: MarketingTimelineProps) {
  const t = useTranslations('dashboardComponents.marketingTimeline')

  // Combine events with revenue data
  const timelineData = useMemo(() => {
    const dataMap = new Map<string, {
      date: string
      revenueCents: number
      events: MarketingEvent[]
    }>()

    // Add revenue data
    revenueData.forEach(point => {
      dataMap.set(point.date, {
        date: point.date,
        revenueCents: point.revenueCents,
        events: []
      })
    })

    // Add events
    events.forEach(event => {
      const existing = dataMap.get(event.date)
      if (existing) {
        existing.events.push(event)
      } else {
        dataMap.set(event.date, {
          date: event.date,
          revenueCents: 0,
          events: [event]
        })
      }
    })

    return Array.from(dataMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [events, revenueData])

  const maxRevenue = useMemo(() => {
    return Math.max(...revenueData.map(d => d.revenueCents), 1)
  }, [revenueData])

  const getEventIcon = (type: MarketingEvent['type']) => {
    switch (type) {
      case 'campaign_start':
        return '🚀'
      case 'campaign_end':
        return '🏁'
      case 'promotion':
        return '🎁'
      case 'event':
        return '📅'
      default:
        return '📌'
    }
  }

  const getEventColor = (type: MarketingEvent['type']) => {
    switch (type) {
      case 'campaign_start':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'campaign_end':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'promotion':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'event':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short'
    }).format(date)
  }

  if (timelineData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {title || t('title')}
          </CardTitle>
          <CardDescription>{description || t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t('noData')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          {title || t('title')}
        </CardTitle>
        <CardDescription>{description || t('description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-8 bg-primary rounded" />
            <span>{t('legend.revenue')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5" />
            <span>{t('legend.events')}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {timelineData.slice(-30).map((item, index) => {
            const heightPercent = (item.revenueCents / maxRevenue) * 100

            return (
              <div key={item.date} className="relative group">
                {/* Date label */}
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs text-muted-foreground w-16 flex-shrink-0">
                    {formatDate(item.date)}
                  </span>

                  {/* Revenue bar */}
                  <div className="flex-1 relative h-8 bg-muted rounded-md overflow-hidden">
                    {item.revenueCents > 0 && (
                      <div
                        className="absolute top-0 left-0 h-full bg-primary transition-all duration-300"
                        style={{ width: `${heightPercent}%` }}
                      />
                    )}

                    {/* Revenue label */}
                    {item.revenueCents > 0 && (
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs font-medium text-foreground">
                          {formatCurrency(item.revenueCents)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Events */}
                {item.events.length > 0 && (
                  <div className="flex items-center gap-2 ml-20 flex-wrap">
                    {item.events.map(event => (
                      <Badge
                        key={event.id}
                        variant="outline"
                        className={cn('gap-1.5 text-xs', getEventColor(event.type))}
                      >
                        <span>{getEventIcon(event.type)}</span>
                        <span>{event.name}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Megaphone className="h-3.5 w-3.5" />
              {t('summary.totalEvents')}
            </div>
            <p className="text-2xl font-bold">{events.length}</p>
          </div>

          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              {t('summary.avgRevenue')}
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(
                revenueData.length > 0
                  ? revenueData.reduce((sum, d) => sum + d.revenueCents, 0) / revenueData.length
                  : 0
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
