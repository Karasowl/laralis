'use client'

import { Calendar, Clock, User, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/money'
import { Treatment, getStatusColor } from './CalendarTypes'

interface TodayAppointmentsProps {
  treatmentsByDate: Record<string, Treatment[]>
  conflictsByDate: Record<string, Set<string>>
  onTreatmentClick: (treatmentId: string) => void
  t: (key: string, params?: Record<string, any>) => string
}

export function TodayAppointments({
  treatmentsByDate,
  conflictsByDate,
  onTreatmentClick,
  t,
}: TodayAppointmentsProps) {
  const today = new Date().toISOString().split('T')[0]
  const todayTreatments = treatmentsByDate[today] || []
  const todayConflicts = conflictsByDate[today]

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t('common.today')}
        </h3>

        {todayTreatments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('treatments.emptyTitle')}
          </p>
        ) : (
          <div className="space-y-3">
            {/* Conflict warning */}
            {todayConflicts && todayConflicts.size > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {t('settings.calendar.conflictWarning')}
                </span>
              </div>
            )}

            {/* Appointments list */}
            {todayTreatments.map(treatment => {
              const isConflict = todayConflicts?.has(treatment.id)
              return (
                <div
                  key={treatment.id}
                  onClick={() => onTreatmentClick(treatment.id)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors',
                    isConflict && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
                  )}
                >
                  <div className="flex items-center gap-4">
                    {isConflict && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                    {treatment?.treatment_time && (
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        {treatment.treatment_time.slice(0, 5)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {treatment.patient
                            ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
                            : t('common.unknown')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {treatment.service?.name || t('common.unknown')} -{' '}
                        {treatment.duration_minutes} min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {formatCurrency(treatment.price_cents)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(getStatusColor(treatment.status))}
                    >
                      {t(`treatments.status.${treatment.status === 'scheduled' ? 'pending' : treatment.status}`)}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
