'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, AlertTriangle, ChevronRight, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CalendarViewProps, getStatusColor, getStatusDot, getTreatmentBorderStyle, isAppointment, Treatment } from './CalendarTypes'

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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect screen size for responsive sheet
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Get treatments for selected date
  const selectedTreatments = useMemo(() => {
    if (!selectedDate) return []
    return treatmentsByDate[selectedDate] || []
  }, [selectedDate, treatmentsByDate])

  // Format selected date for display
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return ''
    const date = new Date(selectedDate + 'T12:00:00')
    return date.toLocaleDateString('default', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }, [selectedDate])

  // Handle day click - always open sheet to view/create treatments
  const handleDayClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr)
    setSheetOpen(true)
  }, [])

  // Handle add treatment from sheet
  const handleAddFromSheet = useCallback(() => {
    if (selectedDate) {
      setSheetOpen(false)
      onCreateTreatment(selectedDate)
    }
  }, [selectedDate, onCreateTreatment])

  return (
    <>
      {/* Week day headers - responsive */}
      <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-1">
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-xs md:text-sm font-medium text-muted-foreground py-1 md:py-2"
          >
            {/* Show single letter on mobile, full abbreviation on desktop */}
            <span className="md:hidden">{day.charAt(0)}</span>
            <span className="hidden md:inline">{day}</span>
          </div>
        ))}
      </div>

      {/* Month grid - responsive */}
      <div className="grid grid-cols-7 gap-0.5 md:gap-1">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="min-h-[44px] md:min-h-[120px] bg-muted/30 rounded md:rounded-lg"
          />
        ))}

        {/* Day cells */}
        {days.map(day => {
          const dateStr = formatDateString(day)
          const dayTreatments = treatmentsByDate[dateStr] || []
          const dayConflicts = conflictsByDate[dateStr]
          const hasConflicts = dayConflicts && dayConflicts.size > 0
          const treatmentCount = dayTreatments.length

          // Group treatments by status for dot indicators (no hook - direct calculation)
          const statusCounts = { pending: 0, in_progress: 0, completed: 0, other: 0 }
          dayTreatments.forEach(t => {
            if (t.status === 'pending' || t.status === 'scheduled') statusCounts.pending++
            else if (t.status === 'in_progress') statusCounts.in_progress++
            else if (t.status === 'completed') statusCounts.completed++
            else statusCounts.other++
          })

          return (
            <div
              key={day}
              onClick={() => handleDayClick(dateStr)}
              className={cn(
                // Base styles - compact on mobile, expanded on desktop
                'min-h-[44px] md:min-h-[120px] rounded md:rounded-lg transition-colors cursor-pointer',
                'border border-transparent md:border-border',
                'p-1 md:p-2',
                // Today highlight
                isToday(day) && 'border-primary bg-primary/5',
                // Conflict highlight
                hasConflicts && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20',
                // Hover states
                'hover:bg-muted/50 md:hover:bg-muted/50',
                // Mobile specific - make it feel tappable
                'active:bg-muted/70 md:active:bg-transparent',
                // Desktop - different cursor when empty
                !treatmentCount && 'md:group'
              )}
            >
              {/* Day number - centered on mobile, left-aligned on desktop */}
              <div className={cn(
                'flex items-center justify-between',
                'mb-0.5 md:mb-1'
              )}>
                <span className={cn(
                  'text-xs md:text-sm font-medium',
                  isToday(day) && 'text-primary',
                  // Mobile: circle around today's number
                  isToday(day) && 'md:bg-transparent bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                )}>
                  {day}
                </span>
                {/* Desktop only - conflict icon and plus */}
                <div className="hidden md:flex items-center gap-1">
                  {hasConflicts && (
                    <span title={t('settings.calendar.hasConflict')}>
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    </span>
                  )}
                  {treatmentCount === 0 && (
                    <Plus className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                  )}
                </div>
              </div>

              {/* Mobile: Dot indicators only */}
              <div className="md:hidden flex items-center justify-center gap-0.5 mt-1">
                {hasConflicts && (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
                {statusCounts.pending > 0 && (
                  <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot('pending'))} />
                )}
                {statusCounts.in_progress > 0 && (
                  <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot('in_progress'))} />
                )}
                {statusCounts.completed > 0 && (
                  <div className={cn('w-1.5 h-1.5 rounded-full', getStatusDot('completed'))} />
                )}
                {/* Show count if more than 3 treatments */}
                {treatmentCount > 3 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">
                    +{treatmentCount - 3}
                  </span>
                )}
              </div>

              {/* Desktop: Full treatment list */}
              <div className="hidden md:block space-y-1 overflow-y-auto max-h-[80px]">
                {dayTreatments.map(treatment => {
                  const isConflict = dayConflicts?.has(treatment.id)
                  const isFutureAppointment = isAppointment(treatment)
                  return (
                    <div
                      key={treatment.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onTreatmentClick(treatment.id)
                      }}
                      className={cn(
                        'text-xs p-1.5 rounded cursor-pointer transition-colors hover:opacity-80',
                        getStatusColor(treatment.status),
                        getTreatmentBorderStyle(treatment),
                        isConflict && 'ring-2 ring-red-400 ring-offset-1'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {isConflict && (
                          <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                        )}
                        {isFutureAppointment ? (
                          <Clock className="h-3 w-3 flex-shrink-0 opacity-70" />
                        ) : (
                          <CheckCircle className="h-3 w-3 flex-shrink-0 opacity-70" />
                        )}
                        {treatment?.treatment_time && (
                          <span className="font-medium">
                            {treatment.treatment_time.slice(0, 5)}
                          </span>
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

      {/* Day detail sheet - responsive (bottom on mobile, right on desktop) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            isMobile ? "h-[70vh] rounded-t-2xl" : "w-[400px] sm:w-[450px]"
          )}
        >
          <SheetHeader className="text-left pb-4 border-b">
            <SheetTitle className="capitalize text-lg">
              {selectedDateFormatted}
            </SheetTitle>
            {selectedTreatments.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('settings.calendar.appointmentsCount', { count: selectedTreatments.length })}
              </p>
            )}
          </SheetHeader>

          <div className="py-4 overflow-y-auto h-[calc(100%-80px)]">
            {selectedTreatments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <p className="text-muted-foreground mb-4">
                  {t('settings.calendar.noAppointments')}
                </p>
                <button
                  onClick={handleAddFromSheet}
                  className="flex items-center gap-2 text-primary font-medium"
                >
                  <Plus className="h-5 w-5" />
                  {t('settings.calendar.clickToCreate')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedTreatments.map(treatment => {
                  const isConflict = selectedDate
                    ? conflictsByDate[selectedDate]?.has(treatment.id)
                    : false
                  const isFutureAppointment = isAppointment(treatment)

                  return (
                    <div
                      key={treatment.id}
                      onClick={() => {
                        setSheetOpen(false)
                        onTreatmentClick(treatment.id)
                      }}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl bg-card',
                        'active:bg-muted/50 transition-colors cursor-pointer',
                        isFutureAppointment ? 'border-2 border-dashed' : 'border',
                        isConflict && 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20'
                      )}
                    >
                      {/* Status indicator */}
                      <div className={cn(
                        'w-1 h-12 rounded-full flex-shrink-0',
                        getStatusDot(treatment.status)
                      )} />

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
                          <span className="font-medium truncate">
                            {treatment.patient
                              ? `${treatment.patient.first_name} ${treatment.patient.last_name}`
                              : t('common.unknown')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {treatment.service?.name || t('common.unknown')}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {treatment.treatment_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {treatment.treatment_time.slice(0, 5)}
                            </span>
                          )}
                          <span>{treatment.duration_minutes} min</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  )
                })}

                {/* Add button at bottom */}
                <button
                  onClick={handleAddFromSheet}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  {t('settings.calendar.clickToCreate')}
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
