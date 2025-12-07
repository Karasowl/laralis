'use client'

import { useMemo } from 'react'
import { Plus, AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarViewProps, getStatusColor, getStatusDot } from './CalendarTypes'

interface WeekViewProps extends CalendarViewProps {
  weekDates: Date[]
}

export function WeekView({
  treatmentsByDate,
  conflictsByDate,
  weekDays,
  weekDates,
  onCreateTreatment,
  onTreatmentClick,
  t,
}: WeekViewProps) {
  const today = new Date().toDateString()

  // For mobile: group all treatments by date for vertical list
  const weekTreatments = useMemo(() => {
    return weekDates.map(date => {
      const dateStr = date.toISOString().split('T')[0]
      const treatments = treatmentsByDate[dateStr] || []
      const conflicts = conflictsByDate[dateStr]
      return {
        date,
        dateStr,
        treatments,
        conflicts,
        hasConflicts: conflicts && conflicts.size > 0,
        isToday: date.toDateString() === today,
      }
    })
  }, [weekDates, treatmentsByDate, conflictsByDate, today])

  return (
    <>
      {/* Desktop: Grid view */}
      <div className="hidden md:block">
        {/* Week day headers with dates */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDates.map((date, i) => (
            <div key={i} className="text-center">
              <div className="text-sm font-medium text-muted-foreground">{weekDays[i]}</div>
              <div className={cn('text-lg font-semibold', date.toDateString() === today && 'text-primary')}>
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0]
            const dayTreatments = treatmentsByDate[dateStr] || []
            const dayConflicts = conflictsByDate[dateStr]
            const hasConflicts = dayConflicts && dayConflicts.size > 0
            const isToday = date.toDateString() === today

            return (
              <div
                key={i}
                onClick={() => dayTreatments.length === 0 && onCreateTreatment(dateStr)}
                className={cn(
                  'min-h-[200px] border rounded-lg p-2 transition-colors group hover:bg-muted/50',
                  isToday && 'border-primary bg-primary/5',
                  hasConflicts && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20',
                  dayTreatments.length === 0 && 'cursor-pointer'
                )}
              >
                {/* Actions header */}
                <div className="flex justify-between items-center mb-1">
                  {hasConflicts && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  {dayTreatments.length === 0 && (
                    <div className="flex justify-center opacity-0 group-hover:opacity-50 transition-opacity">
                      <Plus className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Treatments list */}
                <div className="space-y-1">
                  {dayTreatments.map(treatment => {
                    const isConflict = dayConflicts?.has(treatment.id)
                    return (
                      <div
                        key={treatment.id}
                        onClick={(e) => { e.stopPropagation(); onTreatmentClick(treatment.id) }}
                        className={cn(
                          'text-xs p-2 rounded border cursor-pointer transition-colors hover:opacity-80',
                          getStatusColor(treatment.status),
                          isConflict && 'ring-2 ring-red-400 ring-offset-1'
                        )}
                      >
                        <div className="flex items-center gap-1">
                          {isConflict && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                          <span className="font-medium">{treatment?.treatment_time?.slice(0, 5) || '-'}</span>
                        </div>
                        <div className="truncate">
                          {treatment.patient
                            ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
                            : t('common.unknown')}
                        </div>
                        <div className="truncate text-[10px] opacity-75">
                          {treatment.service?.name || t('common.unknown')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: Vertical list grouped by day */}
      <div className="md:hidden space-y-4">
        {weekTreatments.map(({ date, dateStr, treatments, conflicts, hasConflicts, isToday }) => (
          <div key={dateStr}>
            {/* Day header */}
            <div className={cn(
              'flex items-center gap-3 mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4',
              isToday && 'text-primary'
            )}>
              <div className={cn(
                'flex flex-col items-center justify-center min-w-[44px] h-[44px] rounded-xl',
                isToday
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}>
                <span className="text-xs font-medium uppercase">
                  {weekDays[date.getDay()]}
                </span>
                <span className="text-lg font-bold leading-none">
                  {date.getDate()}
                </span>
              </div>
              <div className="flex-1">
                <p className={cn(
                  'text-sm font-medium capitalize',
                  isToday && 'text-primary'
                )}>
                  {date.toLocaleDateString('default', { month: 'long', day: 'numeric' })}
                </p>
                {treatments.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('settings.calendar.appointmentsCount', { count: treatments.length })}
                  </p>
                )}
              </div>
              {hasConflicts && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>

            {/* Treatments for this day */}
            {treatments.length === 0 ? (
              <button
                onClick={() => onCreateTreatment(dateStr)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">{t('settings.calendar.clickToCreate')}</span>
              </button>
            ) : (
              <div className="space-y-2">
                {treatments.map(treatment => {
                  const isConflict = conflicts?.has(treatment.id)
                  return (
                    <div
                      key={treatment.id}
                      onClick={() => onTreatmentClick(treatment.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border bg-card',
                        'active:bg-muted/50 transition-colors cursor-pointer',
                        isConflict && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
                      )}
                    >
                      {/* Status indicator bar */}
                      <div className={cn(
                        'w-1 h-10 rounded-full flex-shrink-0',
                        getStatusDot(treatment.status)
                      )} />

                      {/* Time */}
                      <div className="flex flex-col items-center justify-center min-w-[48px]">
                        <span className="text-sm font-semibold">
                          {treatment.treatment_time?.slice(0, 5) || '--:--'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {treatment.duration_minutes}m
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isConflict && (
                            <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate">
                            {treatment.patient
                              ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
                              : t('common.unknown')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {treatment.service?.name || t('common.unknown')}
                        </p>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
