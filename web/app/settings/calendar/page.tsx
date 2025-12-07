'use client'

// DEBUG: Version marker
console.log('[calendar-settings] Version: 2024-12-07-v2-suspense-fix')

import { useEffect, useState, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useApi } from '@/hooks/use-api'
import {
  Calendar,
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Unlink,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface CalendarConfig {
  calendar_id: string
  connected_email: string | null
  is_active: boolean
}

interface CalendarStatus {
  connected: boolean
  config: CalendarConfig | null
}

// Separate component to handle URL params with Suspense
function CalendarParamsHandler({
  onSuccess,
  onError
}: {
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const t = useTranslations()
  const searchParams = useSearchParams()

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'connected') {
      onSuccess()
    }

    if (error) {
      let errorMessage = t('settings.calendar.connectionError')
      if (error === 'no_calendars') {
        errorMessage = t('settings.calendar.noCalendars')
      } else if (error === 'permission_denied') {
        errorMessage = t('settings.calendar.permissionDenied')
      }
      onError(errorMessage)
    }
  }, [searchParams, t, onSuccess, onError])

  return null
}

export default function CalendarSettingsPage() {
  const t = useTranslations()
  const { toast } = useToast()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)

  // Fetch calendar status
  const { data: status, isLoading, refetch } = useApi<CalendarStatus>(
    '/api/auth/google-calendar'
  )

  // Handlers for URL params
  const handleSuccess = () => {
    toast({
      title: t('settings.calendar.connectionSuccess'),
      variant: 'default',
    })
    refetch()
  }

  const handleError = (msg: string) => {
    toast({
      title: msg,
      variant: 'destructive',
    })
  }

  // Connect to Google Calendar
  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const response = await fetch('/api/auth/google-calendar?action=connect')
      const data = await response.json()

      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl
      } else {
        throw new Error('Failed to get auth URL')
      }
    } catch (error) {
      toast({
        title: t('settings.calendar.connectionError'),
        variant: 'destructive',
      })
      setIsConnecting(false)
    }
  }

  // Disconnect from Google Calendar
  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const response = await fetch('/api/auth/google-calendar', {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: t('settings.calendar.disconnectSuccess'),
        })
        refetch()
      } else {
        throw new Error('Failed to disconnect')
      }
    } catch (error) {
      toast({
        title: t('settings.calendar.connectionError'),
        variant: 'destructive',
      })
    } finally {
      setIsDisconnecting(false)
      setShowDisconnectDialog(false)
    }
  }

  return (
    <AppLayout>
      {/* Handle URL params in Suspense to avoid hydration issues */}
      <Suspense fallback={null}>
        <CalendarParamsHandler onSuccess={handleSuccess} onError={handleError} />
      </Suspense>

      <div className="p-4 lg:p-8 max-w-[1280px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.calendar.title')}
          subtitle={t('settings.calendar.subtitle')}
        />

        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Google Calendar</CardTitle>
                  <CardDescription>
                    {t('settings.calendar.connectDescription')}
                  </CardDescription>
                </div>
              </div>
              {!isLoading && (
                <Badge
                  variant={status?.connected ? 'default' : 'secondary'}
                  className="gap-1"
                >
                  {status?.connected ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      {t('settings.calendar.connected')}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      {t('settings.calendar.disconnected')}
                    </>
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : status?.connected && status.config ? (
              // Connected state
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t('settings.calendar.connectedAs')}
                    </span>
                    <span className="text-sm font-medium">
                      {status.config.connected_email || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t('settings.calendar.calendarId')}
                    </span>
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {status.config.calendar_id}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDisconnectDialog(true)}
                    disabled={isDisconnecting}
                    className="gap-2"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                    {t('settings.calendar.disconnect')}
                  </Button>
                </div>
              </div>
            ) : (
              // Disconnected state
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('settings.calendar.connectDescription')}
                  </p>
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="gap-2"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  {t('settings.calendar.connect')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">
                {t('settings.calendar.syncSettings')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <CheckCircle className="h-3 w-3 inline mr-2 text-emerald-500" />
              {t('settings.calendar.syncOnCreate')}
            </p>
            <p>
              <CheckCircle className="h-3 w-3 inline mr-2 text-emerald-500" />
              {t('settings.calendar.syncOnUpdate')}
            </p>
            <p>
              <CheckCircle className="h-3 w-3 inline mr-2 text-emerald-500" />
              {t('settings.calendar.syncOnDelete')}
            </p>
          </CardContent>
        </Card>

        {/* Calendar View Link */}
        {status?.connected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('settings.calendar.calendarView')}
              </CardTitle>
              <CardDescription>
                {t('settings.calendar.calendarViewDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <a href="/treatments/calendar" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('settings.calendar.viewCalendar')}
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings.calendar.disconnect')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.calendar.disconnectConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('settings.calendar.disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
