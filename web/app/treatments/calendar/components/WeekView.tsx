'use client'

import { Plus, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarViewProps, getStatusColor } from './CalendarTypes'

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

  return (
    <>
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
    </>
  )
}
