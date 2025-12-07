'use client'

import { Plus, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CalendarViewProps, getStatusColor } from './CalendarTypes'

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

  return (
    <div className="space-y-2">
      <div className={cn('border rounded-lg overflow-hidden', hasConflicts && 'border-red-300 dark:border-red-800')}>
        {/* Conflict warning banner */}
        {hasConflicts && (
          <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {t('settings.calendar.conflictWarning')}
            </span>
          </div>
        )}

        {/* Hourly slots */}
        {hours.map(hour => {
          const hourStr = String(hour).padStart(2, '0')
          const hourTreatments = dayTreatments.filter(t => t.treatment_time?.startsWith(hourStr))
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
                  return (
                    <div
                      key={treatment.id}
                      onClick={(e) => { e.stopPropagation(); onTreatmentClick(treatment.id) }}
                      className={cn(
                        'p-2 rounded border cursor-pointer transition-colors hover:opacity-80 mb-1',
                        getStatusColor(treatment.status),
                        isConflict && 'ring-2 ring-red-400 ring-offset-1'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isConflict && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
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
    </div>
  )
}
