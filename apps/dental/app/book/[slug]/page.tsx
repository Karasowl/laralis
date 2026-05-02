'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Calendar, Clock, ChevronLeft, ChevronRight, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/money'

// Types
interface BookingConfig {
  enabled: boolean
  allow_new_patients: boolean
  require_phone: boolean
  require_notes: boolean
  max_advance_days: number
  min_advance_hours: number
  slot_duration_minutes: number
  working_hours: Record<string, { start: string; end: string } | null>
  welcome_message: string | null
  confirmation_message: string | null
}

interface Service {
  id: string
  name: string
  description: string | null
  price_cents: number
  duration_minutes: number
  category: string | null
}

interface Clinic {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  booking_config: BookingConfig
  services: Service[]
}

interface TimeSlot {
  time: string
  available: boolean
}

type BookingStep = 'service' | 'datetime' | 'info' | 'confirm'

export default function PublicBookingPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('booking')
  const slug = params.slug as string

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [step, setStep] = useState<BookingStep>('service')

  // Selection state
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch clinic data
  useEffect(() => {
    async function fetchClinic() {
      try {
        const res = await fetch(`/api/public/clinic/${slug}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('clinic_not_found')
          } else if (res.status === 403) {
            setError('booking_disabled')
          } else {
            setError('generic')
          }
          return
        }
        const { data } = await res.json()
        setClinic(data)
      } catch (err) {
        setError('generic')
      } finally {
        setLoading(false)
      }
    }
    fetchClinic()
  }, [slug])

  // Fetch available slots when date changes
  useEffect(() => {
    async function fetchSlots() {
      if (!clinic || !selectedDate || !selectedService) return

      setLoadingSlots(true)
      try {
        const dateStr = selectedDate.toISOString().split('T')[0]
        const res = await fetch(
          `/api/public/availability?clinic_id=${clinic.id}&date=${dateStr}&service_id=${selectedService.id}`
        )
        if (res.ok) {
          const { data } = await res.json()
          setAvailableSlots(data.slots || [])
        }
      } catch (err) {
        console.error('Failed to fetch slots:', err)
      } finally {
        setLoadingSlots(false)
      }
    }
    fetchSlots()
  }, [clinic, selectedDate, selectedService])

  // Calendar helpers
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + (clinic?.booking_config.max_advance_days || 30))

  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  function getDaysInMonth(date: Date): (Date | null)[] {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []

    // Add empty slots for days before first of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }

    // Add all days in month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }

    return days
  }

  function isDateSelectable(date: Date): boolean {
    if (date < today) return false
    if (date > maxDate) return false

    // Check if clinic is open on this day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayOfWeek = dayNames[date.getDay()]
    const dayConfig = clinic?.booking_config.working_hours?.[dayOfWeek]

    return !!dayConfig
  }

  // Navigation
  function goToStep(newStep: BookingStep) {
    setStep(newStep)
  }

  function handleServiceSelect(service: Service) {
    setSelectedService(service)
    setSelectedDate(null)
    setSelectedTime(null)
    goToStep('datetime')
  }

  function handleDateSelect(date: Date) {
    setSelectedDate(date)
    setSelectedTime(null)
  }

  function handleTimeSelect(time: string) {
    setSelectedTime(time)
    goToStep('info')
  }

  function handleInfoChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!clinic || !selectedService || !selectedDate || !selectedTime) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinic.id,
          service_id: selectedService.id,
          patient_name: formData.name,
          patient_email: formData.email || null,
          patient_phone: formData.phone || null,
          patient_notes: formData.notes || null,
          requested_date: selectedDate.toISOString().split('T')[0],
          requested_time: selectedTime
        })
      })

      if (!res.ok) {
        const { error } = await res.json()
        setSubmitError(error || 'Failed to create booking')
        return
      }

      const { data } = await res.json()
      // Redirect to confirmation page
      router.push(`/book/${slug}/confirmation?id=${data.id}`)
    } catch (err) {
      setSubmitError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  // Render error state
  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error === 'clinic_not_found' ? t('errors.clinicNotFound') :
               error === 'booking_disabled' ? t('errors.bookingDisabled') :
               t('errors.generic')}
            </h2>
            <p className="text-gray-500">
              {error === 'clinic_not_found' ? t('errors.clinicNotFoundDesc') :
               error === 'booking_disabled' ? t('errors.bookingDisabledDesc') :
               t('errors.genericDesc')}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900">{clinic.name}</h1>
          {clinic.booking_config.welcome_message && (
            <p className="text-sm text-gray-500 mt-1">{clinic.booking_config.welcome_message}</p>
          )}
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between text-sm mb-6">
          {(['service', 'datetime', 'info', 'confirm'] as BookingStep[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-medium',
                  step === s
                    ? 'bg-sky-600 text-white'
                    : i < ['service', 'datetime', 'info', 'confirm'].indexOf(step)
                    ? 'bg-sky-100 text-sky-600'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {i < ['service', 'datetime', 'info', 'confirm'].indexOf(step) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={cn(
                    'w-12 md:w-24 h-0.5 mx-2',
                    i < ['service', 'datetime', 'info', 'confirm'].indexOf(step)
                      ? 'bg-sky-200'
                      : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">{t('steps.selectService')}</h2>
            <div className="grid gap-3">
              {clinic.services.map(service => (
                <Card
                  key={service.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-sky-300 hover:shadow-md',
                    selectedService?.id === service.id && 'border-sky-500 ring-1 ring-sky-500'
                  )}
                  onClick={() => handleServiceSelect(service)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{service.name}</h3>
                        {service.description && (
                          <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {service.duration_minutes} min
                          </span>
                        </div>
                      </div>
                      <span className="text-lg font-semibold text-sky-600">
                        {formatCurrency(service.price_cents)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date/Time Selection */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => goToStep('service')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('actions.back')}
              </Button>
              <h2 className="text-lg font-medium text-gray-900">{t('steps.selectDateTime')}</h2>
            </div>

            {/* Selected Service Summary */}
            {selectedService && (
              <Card className="bg-sky-50 border-sky-200">
                <CardContent className="p-3 flex justify-between items-center">
                  <span className="font-medium">{selectedService.name}</span>
                  <span className="text-sky-600">{formatCurrency(selectedService.price_cents)}</span>
                </CardContent>
              </Card>
            )}

            {/* Calendar */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                    disabled={viewMonth <= new Date(today.getFullYear(), today.getMonth(), 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">
                    {viewMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                    disabled={viewMonth >= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                  {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(day => (
                    <div key={day} className="p-2 text-gray-500 font-medium">{day}</div>
                  ))}
                  {getDaysInMonth(viewMonth).map((date, i) => (
                    <div key={i} className="aspect-square">
                      {date && (
                        <button
                          className={cn(
                            'w-full h-full rounded-lg text-sm font-medium transition-colors',
                            isDateSelectable(date)
                              ? 'hover:bg-sky-100'
                              : 'text-gray-300 cursor-not-allowed',
                            selectedDate?.toDateString() === date.toDateString() &&
                              'bg-sky-600 text-white hover:bg-sky-700'
                          )}
                          onClick={() => isDateSelectable(date) && handleDateSelect(date)}
                          disabled={!isDateSelectable(date)}
                        >
                          {date.getDate()}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Time Slots */}
            {selectedDate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {selectedDate.toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </CardTitle>
                  <CardDescription>{t('steps.selectTime')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSlots ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                    </div>
                  ) : availableSlots.filter(s => s.available).length === 0 ? (
                    <p className="text-center text-gray-500 py-4">{t('errors.noAvailableSlots')}</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots
                        .filter(slot => slot.available)
                        .map(slot => (
                          <Button
                            key={slot.time}
                            variant={selectedTime === slot.time ? 'default' : 'outline'}
                            className={cn(
                              selectedTime === slot.time && 'bg-sky-600 hover:bg-sky-700'
                            )}
                            onClick={() => handleTimeSelect(slot.time)}
                          >
                            {slot.time}
                          </Button>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Patient Info */}
        {step === 'info' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => goToStep('datetime')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('actions.back')}
              </Button>
              <h2 className="text-lg font-medium text-gray-900">{t('steps.yourInfo')}</h2>
            </div>

            {/* Appointment Summary */}
            <Card className="bg-sky-50 border-sky-200">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('fields.service')}</span>
                  <span className="font-medium">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('fields.date')}</span>
                  <span className="font-medium">
                    {selectedDate?.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('fields.time')}</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">{t('fields.price')}</span>
                  <span className="font-semibold text-sky-600">{formatCurrency(selectedService?.price_cents || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Patient Form */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label htmlFor="name">{t('fields.name')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => handleInfoChange('name', e.target.value)}
                    placeholder={t('placeholders.name')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">{t('fields.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={e => handleInfoChange('email', e.target.value)}
                    placeholder={t('placeholders.email')}
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('hints.emailConfirmation')}</p>
                </div>

                <div>
                  <Label htmlFor="phone">
                    {t('fields.phone')} {clinic.booking_config.require_phone && '*'}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={e => handleInfoChange('phone', e.target.value)}
                    placeholder={t('placeholders.phone')}
                    required={clinic.booking_config.require_phone}
                  />
                </div>

                {(clinic.booking_config.require_notes || true) && (
                  <div>
                    <Label htmlFor="notes">
                      {t('fields.notes')} {clinic.booking_config.require_notes && '*'}
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={e => handleInfoChange('notes', e.target.value)}
                      placeholder={t('placeholders.notes')}
                      rows={3}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {submitError}
              </div>
            )}

            <Button
              className="w-full bg-sky-600 hover:bg-sky-700"
              size="lg"
              disabled={!formData.name || (clinic.booking_config.require_phone && !formData.phone) || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('actions.processing')}
                </>
              ) : (
                t('actions.confirmBooking')
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
