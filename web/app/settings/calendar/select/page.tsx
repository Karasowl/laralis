'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoogleCalendar {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

export default function CalendarSelectPage() {
  const t = useTranslations()
  const router = useRouter()
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Fetch available calendars
  useEffect(() => {
    let mounted = true

    const fetchCalendars = async () => {
      try {
        const response = await fetch('/api/auth/google-calendar?action=calendars')
        const data = await response.json()

        if (!mounted) return

        if (data.error) {
          setError(data.error)
          return
        }

        setCalendars(data.calendars || [])
        setEmail(data.email || '')

        // Pre-select primary calendar
        const primary = data.calendars?.find((c: GoogleCalendar) => c.primary)
        if (primary) {
          setSelectedCalendar(primary.id)
        }
      } catch (err) {
        if (!mounted) return
        setError('Failed to load calendars')
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchCalendars()

    return () => {
      mounted = false
    }
  }, [])

  // Handle calendar selection and connection
  const handleConnect = async () => {
    if (!selectedCalendar) return

    setIsConnecting(true)
    try {
      const response = await fetch('/api/auth/google-calendar/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: selectedCalendar }),
      })

      if (response.ok) {
        router.push('/settings/calendar?success=connected')
      } else {
        const data = await response.json()
        setError(data.error || 'Connection failed')
      }
    } catch {
      setError('Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }

  // Cancel and go back
  const handleCancel = async () => {
    await fetch('/api/auth/google-calendar', { method: 'DELETE' })
    router.push('/settings/calendar')
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8 max-w-[800px] mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => router.push('/settings/calendar')}>
                {t('common.back')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[800px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('settings.calendar.selectCalendar')}</h1>
            <p className="text-muted-foreground">{t('settings.calendar.selectCalendarDescription')}</p>
          </div>
          <Button variant="ghost" onClick={handleCancel}>
            {t('common.back')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.calendar.chooseCalendar')}</CardTitle>
            {email && (
              <p className="text-sm text-muted-foreground">
                {t('settings.calendar.connectedAs')}: {email}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : calendars.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('settings.calendar.noCalendars')}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  {calendars.map((calendar) => (
                    <button
                      key={calendar.id}
                      onClick={() => setSelectedCalendar(calendar.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-colors',
                        selectedCalendar === calendar.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{calendar.summary}</span>
                          {calendar.primary && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3 fill-current" />
                              {t('settings.calendar.primaryCalendar')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{calendar.id}</p>
                      </div>
                      {selectedCalendar === calendar.id && (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handleCancel} disabled={isConnecting}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleConnect}
                    disabled={!selectedCalendar || isConnecting}
                    className="flex-1"
                  >
                    {isConnecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {t('settings.calendar.connectSelected')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t('settings.calendar.selectInfo')}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
