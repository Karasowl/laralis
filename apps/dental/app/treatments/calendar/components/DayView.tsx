'use client'

import { useMemo } from 'react'
import { Plus, AlertTriangle, Clock, ChevronRight, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CalendarViewProps, getStatusColor, getStatusDot, getTreatmentBorderStyle, isAppointment } from './CalendarTypes'

interface DayViewProps extends CalendarViewProps {}

// Generate 30-minute time slots (8:00 to 19:30)
function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 8; hour < 20; hour++) {
    const hourStr = String(hour).padStart(2, '0')
    slots.push(`${hourStr}:00`)
    slots.push(`${hourStr}:30`)
  }
  return slots
}

// Check if a treatment falls within a specific 30-min slot
function treatmentInSlot(treatmentTime: string | null | undefined, slotTime: string): boolean {
  if (!treatmentTime) return false
  const [slotHour, slotMinute] = slotTime.split(':').map(Number)
  const [treatHour, treatMinute] = treatmentTime.split(':').map(Number)

  // Check if treatment starts in this 30-min window
  if (treatHour !== slotHour) return false
  if (slotMinute === 0) return treatMinute >= 0 && treatMinute < 30
  return treatMinute >= 30 && treatMinute < 60
}

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

  // Generate 30-minute time slots
  const timeSlots = useMemo(() => generateTimeSlots(), [])

  // Group treatments by 30-minute slot for desktop view
  const treatmentsBySlot = useMemo(() => {
    const grouped: Record<string, typeof dayTreatments> = {}
    timeSlots.forEach(slot => {
      grouped[slot] = dayTreatments.filter(t => treatmentInSlot(t.treatment_time, slot))
    })
    return grouped
  }, [dayTreatments, timeSlots])

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

      {/* Desktop: 30-minute slots view */}
      <div className={cn(
        'hidden md:block border rounded-lg overflow-hidden',
        hasConflicts && 'border-red-300 dark:border-red-800'
      )}>
        {timeSlots.map(slot => {
          const slotTreatments = treatmentsBySlot[slot] || []
          const hasSlotConflict = slotTreatments.some(t => dayConflicts?.has(t.id))
          const isHalfHour = slot.endsWith(':30')

          return (
            <div
              key={slot}
              onClick={() => slotTreatments.length === 0 && onCreateTreatment(dateStr, slot)}
              className={cn(
                'flex border-b last:border-b-0 transition-colors group',
                // Half-hour slots are smaller and more subtle
                isHalfHour ? 'min-h-[40px] border-b-dashed' : 'min-h-[48px]',
                slotTreatments.length === 0 && 'cursor-pointer hover:bg-muted/30',
                hasSlotConflict && 'bg-red-50/50 dark:bg-red-900/10'
              )}
            >
              {/* Time label */}
              <div className={cn(
                'w-20 p-2 border-r text-sm',
                // Half-hour labels are smaller and muted
                isHalfHour ? 'text-xs text-muted-foreground/70 pt-1' : 'font-medium',
                hasSlotConflict ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
              )}>
                <div className="flex items-center gap-1">
                  {hasSlotConflict && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  {slot}
                </div>
              </div>

              {/* Treatments for this slot */}
              <div className="flex-1 p-1.5 relative">
                {slotTreatments.length === 0 && (
                  <Plus className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
                {slotTreatments.map(treatment => {
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
