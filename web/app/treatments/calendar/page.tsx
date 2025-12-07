'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/hooks/use-api'
import { ChevronLeft, ChevronRight, Loader2, List, Calendar } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { findAllConflictsForDate, Appointment } from '@/lib/calendar/conflict-detection'
import {
  MonthView,
  WeekView,
  DayView,
  TodayAppointments,
  getStatusDot,
  Treatment,
  ViewMode,
} from './components'

interface ApiResponse {
  data: Treatment[]
}

export default function TreatmentsCalendarPage() {
  const t = useTranslations()
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  // Fetch treatments
  const { data: response, loading } = useApi<ApiResponse>('/api/treatments')
  const treatments = response?.data || []

  // Navigate to create treatment with pre-filled date
  const handleCreateTreatment = useCallback((date: string, time?: string) => {
    const params = new URLSearchParams({ date })
    if (time) params.set('time', time)
    router.push(`/treatments?create=true&${params.toString()}`)
  }, [router])

  // Handle treatment click
  const handleTreatmentClick = useCallback((treatmentId: string) => {
    router.push(`/treatments?edit=${treatmentId}`)
  }, [router])

  // Get current month's days
  const { days, startDay, monthName, year } = useMemo(() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDay = firstDay.getDay() // 0 = Sunday

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const monthName = currentDate.toLocaleDateString('default', { month: 'long' })
    const year = currentDate.getFullYear()

    return { days, startDay, monthName, year }
  }, [currentDate])

  // Group treatments by date
  const treatmentsByDate = useMemo(() => {
    const grouped: Record<string, Treatment[]> = {}
    treatments.forEach(treatment => {
      const date = treatment.treatment_date
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(treatment)
    })
    // Sort by time within each day
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const timeA = a.treatment_time || '00:00'
        const timeB = b.treatment_time || '00:00'
        return timeA.localeCompare(timeB)
      })
    })
    return grouped
  }, [treatments])

  // Calculate conflicts for visual indicators
  const conflictsByDate = useMemo(() => {
    const conflictMap: Record<string, Set<string>> = {}
    const dates = Object.keys(treatmentsByDate)

    for (const date of dates) {
      const dayTreatments = treatmentsByDate[date]
      const activeAppointments: Appointment[] = dayTreatments
        .filter(t => ['pending', 'scheduled', 'in_progress'].includes(t.status))
        .map(t => ({
          id: t.id,
          treatment_date: t.treatment_date,
          treatment_time: t.treatment_time,
          duration_minutes: t.duration_minutes,
          patient_name: t.patient ? `${t.patient.first_name} ${t.patient.last_name}` : undefined,
          service_name: t.service?.name,
        }))

      const conflicts = findAllConflictsForDate(activeAppointments, date)
      if (conflicts.size > 0) {
        conflictMap[date] = new Set(conflicts.keys())
      }
    }
    return conflictMap
  }, [treatmentsByDate])

  // Navigation based on view mode
  const goToPrevious = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000))
    }
  }, [currentDate, viewMode])

  const goToNext = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000))
    }
  }, [currentDate, viewMode])

  const goToToday = useCallback(() => setCurrentDate(new Date()), [])

  // Format date string for month view
  const formatDateString = useCallback((day: number) => {
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return `${currentDate.getFullYear()}-${month}-${dayStr}`
  }, [currentDate])

  // Check if date is today (for month view)
  const isToday = useCallback((day: number) => {
    const today = new Date()
    return today.getDate() === day &&
           today.getMonth() === currentDate.getMonth() &&
           today.getFullYear() === currentDate.getFullYear()
  }, [currentDate])

  // Get week dates for week view
  const weekDates = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - day) // Start from Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }, [currentDate])

  // Days of week headers (using i18n)
  const weekDays = useMemo(() => [
    t('timeSettings.workDays.days.sunday.short'),
    t('timeSettings.workDays.days.monday.short'),
    t('timeSettings.workDays.days.tuesday.short'),
    t('timeSettings.workDays.days.wednesday.short'),
    t('timeSettings.workDays.days.thursday.short'),
    t('timeSettings.workDays.days.friday.short'),
    t('timeSettings.workDays.days.saturday.short'),
  ], [t])

  // Shared props for view components
  const viewProps = {
    treatments,
    treatmentsByDate,
    conflictsByDate,
    weekDays,
    currentDate,
    onCreateTreatment: handleCreateTreatment,
    onTreatmentClick: handleTreatmentClick,
    t,
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('treatments.title')}
          subtitle={t('treatments.subtitle')}
        />

        {/* View Toggle Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
          <Link
            href="/treatments"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">{t('treatments.views.list')}</span>
          </Link>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-background shadow-sm text-foreground font-medium"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{t('treatments.views.calendar')}</span>
          </div>
        </div>

        {/* Calendar Card */}
        <Card>
          <CardContent className="p-4">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {t('common.today')}
                </Button>
              </div>

              <h2 className="text-xl font-semibold capitalize">
                {viewMode === 'day'
                  ? currentDate.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  : `${monthName} ${year}`}
              </h2>

              {/* View mode toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode(mode)}
                  >
                    {t(`settings.calendar.view${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Status legend */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Badge variant="outline" className="gap-1">
                <div className={cn('w-2 h-2 rounded-full', getStatusDot('pending'))} />
                {t('treatments.status.pending')}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <div className={cn('w-2 h-2 rounded-full', getStatusDot('in_progress'))} />
                {t('treatments.status.in_progress')}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <div className={cn('w-2 h-2 rounded-full', getStatusDot('completed'))} />
                {t('treatments.status.completed')}
              </Badge>
            </div>

            {/* Calendar content */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : viewMode === 'month' ? (
              <MonthView
                {...viewProps}
                days={days}
                startDay={startDay}
                formatDateString={formatDateString}
                isToday={isToday}
              />
            ) : viewMode === 'week' ? (
              <WeekView {...viewProps} weekDates={weekDates} />
            ) : (
              <DayView {...viewProps} />
            )}
          </CardContent>
        </Card>

        {/* Today's appointments */}
        <TodayAppointments
          treatmentsByDate={treatmentsByDate}
          conflictsByDate={conflictsByDate}
          onTreatmentClick={handleTreatmentClick}
          t={t}
        />
      </div>
    </AppLayout>
  )
}
