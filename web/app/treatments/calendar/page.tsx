'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/hooks/use-api'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/money'

interface Treatment {
  id: string
  treatment_date: string
  treatment_time: string | null
  status: string
  duration_minutes: number
  price_cents: number
  patient?: {
    id: string
    first_name: string
    last_name: string
  }
  service?: {
    id: string
    name: string
  }
}

interface ApiResponse {
  data: Treatment[]
}

export default function TreatmentsCalendarPage() {
  const t = useTranslations()
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())

  // Fetch treatments
  const { data: response, loading } = useApi<ApiResponse>('/api/treatments')
  const treatments = response?.data || []

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
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(treatment)
    })
    // Sort by time within each day
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        if (!a || !b) return 0
        const timeA = a.treatment_time || '00:00'
        const timeB = b.treatment_time || '00:00'
        return timeA.localeCompare(timeB)
      })
    })
    return grouped
  }, [treatments])

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Format date string
  const formatDateString = (day: number) => {
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return `${currentDate.getFullYear()}-${month}-${dayStr}`
  }

  // Check if date is today
  const isToday = (day: number) => {
    const today = new Date()
    return (
      today.getDate() === day &&
      today.getMonth() === currentDate.getMonth() &&
      today.getFullYear() === currentDate.getFullYear()
    )
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'scheduled':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  // Handle treatment click
  const handleTreatmentClick = (treatmentId: string) => {
    router.push(`/treatments?edit=${treatmentId}`)
  }

  // Days of week headers
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.calendar.calendarView')}
          subtitle={t('settings.calendar.calendarViewDescription')}
          actions={
            <Button variant="outline" onClick={() => router.push('/treatments')}>
              {t('common.back')}
            </Button>
          }
        />

        {/* Calendar Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {t('common.today')}
                </Button>
              </div>
              <h2 className="text-xl font-semibold capitalize">
                {monthName} {year}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  {t('treatments.status.pending')}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t('treatments.status.completed')}
                </Badge>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Week day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {weekDays.map(day => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for days before month starts */}
                  {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[120px] bg-muted/30 rounded-lg" />
                  ))}

                  {/* Days of month */}
                  {days.map(day => {
                    const dateStr = formatDateString(day)
                    const dayTreatments = treatmentsByDate[dateStr] || []

                    return (
                      <div
                        key={day}
                        className={cn(
                          'min-h-[120px] border rounded-lg p-2 transition-colors',
                          isToday(day) && 'border-primary bg-primary/5',
                          !isToday(day) && 'border-border hover:bg-muted/50'
                        )}
                      >
                        <div
                          className={cn(
                            'text-sm font-medium mb-1',
                            isToday(day) && 'text-primary'
                          )}
                        >
                          {day}
                        </div>
                        <div className="space-y-1 overflow-y-auto max-h-[80px]">
                          {dayTreatments.map(treatment => (
                            <div
                              key={treatment.id}
                              onClick={() => handleTreatmentClick(treatment.id)}
                              className={cn(
                                'text-xs p-1.5 rounded border cursor-pointer transition-colors hover:opacity-80',
                                getStatusColor(treatment.status)
                              )}
                            >
                              <div className="flex items-center gap-1">
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
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's appointments detail */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('common.today')}
            </h3>
            {(() => {
              const today = new Date().toISOString().split('T')[0]
              const todayTreatments = treatmentsByDate[today] || []

              if (todayTreatments.length === 0) {
                return (
                  <p className="text-muted-foreground text-sm">
                    {t('treatments.emptyTitle')}
                  </p>
                )
              }

              return (
                <div className="space-y-3">
                  {todayTreatments.map(treatment => (
                    <div
                      key={treatment.id}
                      onClick={() => handleTreatmentClick(treatment.id)}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
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
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
