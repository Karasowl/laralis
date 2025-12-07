'use client'

import { useMemo } from 'react'
import { Plus, AlertTriangle, Clock, ChevronRight, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CalendarViewProps, getStatusColor, getStatusDot, getTreatmentBorderStyle, isAppointment } from './CalendarTypes'

interface DayViewProps extends CalendarViewProps {}

export function DayView({
  treatmentsByDate,
  conflictsByDate,
  currentDate,
  onCreateTreatment,
  onTreatmentClick,
  t,
}: DayViewProps) {
  const dateStr = currentDate.toISOString().split('T')[0]
  const dayTreatments = treatmentsByDate[dateStr] || []
  const dayConflicts = conflictsByDate[dateStr]
  const hasConflicts = dayConflicts && dayConflicts.size > 0
  const hours = Array.from({ length: 12 }, (_, i) => i + 8) // 8am to 7pm

  // Group treatments by hour for desktop view
  const treatmentsByHour = useMemo(() => {
    const grouped: Record<string, typeof dayTreatments> = {}
    hours.forEach(hour => {
      const hourStr = String(hour).padStart(2, '0')
      grouped[hourStr] = dayTreatments.filter(t => t.treatment_time?.startsWith(hourStr))
    })
    return grouped
  }, [dayTreatments, hours])

  return (
    <div className="space-y-2">
      {/* Conflict warning banner - both mobile and desktop */}
      {hasConflicts && (
        <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-300">
            {t('settings.calendar.conflictWarning')}
          </span>
        </div>
      )}

      {/* Desktop: Hourly slots view */}
      <div className={cn(
        'hidden md:block border rounded-lg overflow-hidden',
        hasConflicts && 'border-red-300 dark:border-red-800'
      )}>
        {hours.map(hour => {
          const hourStr = String(hour).padStart(2, '0')
          const hourTreatments = treatmentsByHour[hourStr] || []
          const hasHourConflict = hourTreatments.some(t => dayConflicts?.has(t.id))

          return (
            <div
              key={hour}
              onClick={() => hourTreatments.length === 0 && onCreateTreatment(dateStr, `${hourStr}:00`)}
              className={cn(
                'flex border-b last:border-b-0 min-h-[60px] hover:bg-muted/30 transition-colors group',
                hourTreatments.length === 0 && 'cursor-pointer',
                hasHourConflict && 'bg-red-50/50 dark:bg-red-900/10'
              )}
            >
              {/* Hour label */}
              <div className={cn(
                'w-20 p-2 border-r text-sm font-medium',
                hasHourConflict ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              )}>
                <div className="flex items-center gap-1">
                  {hasHourConflict && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  {hourStr}:00
                </div>
              </div>

              {/* Treatments for this hour */}
              <div className="flex-1 p-2 relative">
                {hourTreatments.length === 0 && (
                  <Plus className="h-4 w-4 absolute right-2 top-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
                {hourTreatments.map(treatment => {
                  const isConflict = dayConflicts?.has(treatment.id)
                  const isFutureAppointment = isAppointment(treatment)
                  return (
                    <div
                      key={treatment.id}
                      onClick={(e) => { e.stopPropagation(); onTreatmentClick(treatment.id) }}
                      className={cn(
                        'p-2 rounded cursor-pointer transition-colors hover:opacity-80 mb-1',
                        getStatusColor(treatment.status),
                        getTreatmentBorderStyle(treatment),
                        isConflict && 'ring-2 ring-red-400 ring-offset-1'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isConflict && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                        {isFutureAppointment ? (
                          <Clock className="h-4 w-4 flex-shrink-0 opacity-70" />
                        ) : (
                          <CheckCircle className="h-4 w-4 flex-shrink-0 opacity-70" />
                        )}
                        <span className="font-medium">{treatment.treatment_time?.slice(0, 5)}</span>
                        <span>
                          {treatment.patient
                            ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
                            : t('common.unknown')}
                        </span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {treatment.duration_minutes} min
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{treatment.service?.name}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: Clean list view */}
      <div className="md:hidden">
        {dayTreatments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              {t('settings.calendar.noAppointments')}
            </p>
            <button
              onClick={() => onCreateTreatment(dateStr)}
              className="flex items-center gap-2 text-primary font-medium"
            >
              <Plus className="h-5 w-5" />
              {t('settings.calendar.clickToCreate')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayTreatments.map(treatment => {
              const isConflict = dayConflicts?.has(treatment.id)
              const isFutureAppointment = isAppointment(treatment)
              return (
                <div
                  key={treatment.id}
                  onClick={() => onTreatmentClick(treatment.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl bg-card',
                    'active:bg-muted/50 transition-colors cursor-pointer',
                    isFutureAppointment ? 'border-2 border-dashed' : 'border',
                    isConflict && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
                  )}
                >
                  {/* Status indicator bar */}
                  <div className={cn(
                    'w-1 min-h-[56px] rounded-full flex-shrink-0',
                    getStatusDot(treatment.status)
                  )} />

                  {/* Time column */}
                  <div className="flex flex-col items-center min-w-[56px]">
                    <span className="text-lg font-bold">
                      {treatment.treatment_time?.slice(0, 5) || '--:--'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {treatment.duration_minutes} min
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isConflict && (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      {isFutureAppointment ? (
                        <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold truncate">
                        {treatment.patient
                          ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
                          : t('common.unknown')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {treatment.service?.name || t('common.unknown')}
                    </p>

                    {/* Status badge on mobile */}
                    <Badge
                      variant="outline"
                      className={cn('mt-2 text-xs', getStatusColor(treatment.status))}
                    >
                      {t(`treatments.status.${treatment.status === 'scheduled' ? 'pending' : treatment.status}`)}
                    </Badge>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              )
            })}

            {/* Add button at bottom */}
            <button
              onClick={() => onCreateTreatment(dateStr)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="h-5 w-5" />
              {t('settings.calendar.clickToCreate')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
