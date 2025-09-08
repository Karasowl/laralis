'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency } from '@/lib/format'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { User, Package, DollarSign, Calendar, Activity } from 'lucide-react'

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
  title = 'Recent Activity',
  description = 'Latest actions in your clinic'
}: RecentActivityProps) {
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
      case 'treatment': return 'bg-blue-100 text-blue-600'
      case 'patient': return 'bg-green-100 text-green-600'
      case 'expense': return 'bg-red-100 text-red-600'
      case 'appointment': return 'bg-purple-100 text-purple-600'
      case 'supply': return 'bg-yellow-100 text-yellow-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay actividad reciente
            </p>
          ) : (
            activities.map((activity) => {
              const Icon = getActivityIcon(activity.type)
              const colorClass = getActivityColor(activity.type)
              
              return (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.amount && (
                        <span className="text-sm font-medium">
                          {formatCurrency(activity.amount)}
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
                        {formatDistanceToNow(activity.timestamp, { 
                          addSuffix: true,
                          locale: es 
                        })}
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