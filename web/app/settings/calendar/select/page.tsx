'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Calendar,
  Loader2,
  CheckCircle,
  Star,
  ArrowLeft,
} from 'lucide-react'
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
  const { toast } = useToast()
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [email, setEmail] = useState<string>('')

  // Fetch available calendars
  useEffect(() => {
    let mounted = true

    const fetchCalendars = async () => {
      try {
        const response = await fetch('/api/auth/google-calendar?action=calendars')
        const data = await response.json()

        if (!mounted) return

        if (data.error) {
          toast({
            title: t('settings.calendar.connectionError'),
            description: data.error,
            variant: 'destructive',
          })
          router.push('/settings/calendar')
          return
        }

        setCalendars(data.calendars || [])
        setEmail(data.email || '')

        // Pre-select primary calendar
        const primary = data.calendars?.find((c: GoogleCalendar) => c.primary)
        if (primary) {
          setSelectedCalendar(primary.id)
        }
      } catch {
        if (!mounted) return
        toast({
          title: t('settings.calendar.connectionError'),
          variant: 'destructive',
        })
        router.push('/settings/calendar')
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        toast({
          title: t('settings.calendar.connectionSuccess'),
        })
        router.push('/settings/calendar?success=connected')
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Connection failed')
      }
    } catch (error) {
      toast({
        title: t('settings.calendar.connectionError'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setIsConnecting(false)
    }
  }

  // Cancel and go back
  const handleCancel = async () => {
    // Delete the pending configuration
    await fetch('/api/auth/google-calendar', { method: 'DELETE' })
    router.push('/settings/calendar')
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[800px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.calendar.selectCalendar')}
          subtitle={t('settings.calendar.selectCalendarDescription')}
          actions={
            <Button variant="ghost" onClick={handleCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {t('settings.calendar.chooseCalendar')}
                </CardTitle>
                {email && (
                  <CardDescription>
                    {t('settings.calendar.connectedAs')}: {email}
                  </CardDescription>
                )}
              </div>
            </div>
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
                        style={{
                          backgroundColor: calendar.backgroundColor || '#4285f4'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {calendar.summary}
                          </span>
                          {calendar.primary && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3 fill-current" />
                              {t('settings.calendar.primaryCalendar')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {calendar.id}
                        </p>
                      </div>
                      {selectedCalendar === calendar.id && (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isConnecting}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleConnect}
                    disabled={!selectedCalendar || isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {t('settings.calendar.connectSelected')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info card */}
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
