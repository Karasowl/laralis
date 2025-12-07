'use client'

import { useMemo } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarViewProps, getStatusColor } from './CalendarTypes'

interface MonthViewProps extends CalendarViewProps {
  days: number[]
  startDay: number
  formatDateString: (day: number) => string
  isToday: (day: number) => boolean
}

export function MonthView({
  treatmentsByDate,
  conflictsByDate,
  weekDays,
  days,
  startDay,
  formatDateString,
  isToday,
  onCreateTreatment,
  onTreatmentClick,
  t,
}: MonthViewProps) {
  return (
    <>
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[120px] bg-muted/30 rounded-lg" />
        ))}

        {/* Day cells */}
        {days.map(day => {
          const dateStr = formatDateString(day)
          const dayTreatments = treatmentsByDate[dateStr] || []
          const dayConflicts = conflictsByDate[dateStr]
          const hasConflicts = dayConflicts && dayConflicts.size > 0

          return (
            <div
              key={day}
              onClick={() => dayTreatments.length === 0 && onCreateTreatment(dateStr)}
              className={cn(
                'min-h-[120px] border rounded-lg p-2 transition-colors group',
                isToday(day) && 'border-primary bg-primary/5',
                !isToday(day) && 'border-border hover:bg-muted/50',
                hasConflicts && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20',
                dayTreatments.length === 0 && 'cursor-pointer'
              )}
            >
              {/* Day header */}
              <div className={cn('text-sm font-medium mb-1 flex justify-between items-center', isToday(day) && 'text-primary')}>
                <span>{day}</span>
                <div className="flex items-center gap-1">
                  {hasConflicts && (
                    <AlertTriangle className="h-3 w-3 text-red-500" title={t('settings.calendar.hasConflict')} />
                  )}
                  {dayTreatments.length === 0 && (
                    <Plus className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                  )}
                </div>
              </div>

              {/* Treatments list */}
              <div className="space-y-1 overflow-y-auto max-h-[80px]">
                {dayTreatments.map(treatment => {
                  const isConflict = dayConflicts?.has(treatment.id)
                  return (
                    <div
                      key={treatment.id}
                      onClick={(e) => { e.stopPropagation(); onTreatmentClick(treatment.id) }}
                      className={cn(
                        'text-xs p-1.5 rounded border cursor-pointer transition-colors hover:opacity-80',
                        getStatusColor(treatment.status),
                        isConflict && 'ring-2 ring-red-400 ring-offset-1'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {isConflict && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                        {treatment?.treatment_time && (
                          <span className="font-medium">{treatment.treatment_time.slice(0, 5)}</span>
                        )}
                        <span className="truncate">
                          {treatment.patient
                            ? `${treatment.patient.first_name} ${treatment.patient.last_name.charAt(0)}.`
                            : t('common.unknown')}
                        </span>
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
