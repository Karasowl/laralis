'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface GoogleCalendar {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

export default function CalendarSelectPage() {
  const router = useRouter()
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

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

        const primary = data.calendars?.find((c: GoogleCalendar) => c.primary)
        if (primary) {
          setSelectedCalendar(primary.id)
        }
      } catch {
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

  const handleCancel = async () => {
    await fetch('/api/auth/google-calendar', { method: 'DELETE' })
    router.push('/settings/calendar')
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/settings/calendar')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Seleccionar Calendario
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Elige el calendario de Google que quieres sincronizar
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            Cancelar
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
            Calendarios disponibles
          </h2>
          {email && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Conectado como: {email}
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : calendars.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se encontraron calendarios
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {calendars.map((calendar) => (
                  <button
                    key={calendar.id}
                    onClick={() => setSelectedCalendar(calendar.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-colors ${
                      selectedCalendar === calendar.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {calendar.summary}
                        </span>
                        {calendar.primary && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            ⭐ Principal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {calendar.id}
                      </p>
                    </div>
                    {selectedCalendar === calendar.id && (
                      <span className="text-blue-500 text-xl">✓</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCancel}
                  disabled={isConnecting}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!selectedCalendar || isConnecting}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isConnecting && (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Conectar calendario seleccionado
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Los tratamientos programados se sincronizarán automáticamente con el calendario seleccionado.
          </p>
        </div>
      </div>
    </div>
  )
}
