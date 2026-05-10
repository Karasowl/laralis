'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// DEBUG: Version marker to verify deployment
console.log('[calendar-select] Version: 2024-12-07-v4-apple-style')

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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 p-8 text-center border border-gray-100 dark:border-gray-800">
            {/* Error icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Error de conexion
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">{error}</p>

            <button
              onClick={() => router.push('/settings/calendar')}
              className="w-full py-3 px-6 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 active:scale-[0.98]"
            >
              Volver a configuracion
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header bar */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              <span className="text-sm font-medium">Cancelar</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.5 22.5a3 3 0 003-3v-8.174l-6.879 4.022 3.485 1.876a.75.75 0 01-.712 1.321l-5.683-3.06a1.5 1.5 0 00-1.422 0l-5.683 3.06a.75.75 0 01-.712-1.32l3.485-1.877L1.5 11.326V19.5a3 3 0 003 3h15z" />
                  <path d="M1.5 9.589v-.745a3 3 0 011.578-2.641l7.5-4.039a3 3 0 012.844 0l7.5 4.039A3 3 0 0122.5 8.844v.745l-8.426 4.926-.652-.35a3 3 0 00-2.844 0l-.652.35L1.5 9.59z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Title section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
            Selecciona tu calendario
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Elige el calendario de Google donde se sincronizaran tus citas y tratamientos
          </p>
        </div>

        {/* Email badge */}
        {email && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-300">{email}</span>
            </div>
          </div>
        )}

        {/* Calendar list card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Calendarios disponibles
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {calendars.length} {calendars.length === 1 ? 'calendario encontrado' : 'calendarios encontrados'}
                </p>
              </div>
            </div>
          </div>

          {/* Calendar list */}
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
                  <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                </div>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Cargando calendarios...</p>
              </div>
            ) : calendars.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No se encontraron calendarios</p>
              </div>
            ) : (
              <div className="space-y-3">
                {calendars.map((calendar) => {
                  const isSelected = selectedCalendar === calendar.id
                  const calendarColor = calendar.backgroundColor || '#4285f4'

                  return (
                    <button
                      key={calendar.id}
                      onClick={() => setSelectedCalendar(calendar.id)}
                      className={`
                        w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left
                        transition-all duration-200 ease-out
                        ${isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-lg shadow-blue-500/10'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }
                        active:scale-[0.99]
                      `}
                    >
                      {/* Calendar color indicator */}
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-xl shadow-md"
                          style={{
                            backgroundColor: calendarColor,
                            boxShadow: `0 4px 12px ${calendarColor}40`
                          }}
                        />
                        {calendar.primary && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-md">
                            <svg className="w-3 h-3 text-amber-900" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Calendar info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-gray-900 dark:text-white truncate">
                            {calendar.summary}
                          </span>
                          {calendar.primary && (
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                              Principal
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {calendar.id}
                        </p>
                      </div>

                      {/* Selection indicator */}
                      <div className={`
                        flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                        transition-all duration-200
                        ${isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 dark:border-gray-600'
                        }
                      `}>
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isLoading && calendars.length > 0 && (
            <div className="px-4 sm:px-6 pb-6 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCancel}
                  disabled={isConnecting}
                  className="
                    sm:w-auto px-6 py-3.5
                    bg-gray-100 dark:bg-gray-800
                    text-gray-700 dark:text-gray-300
                    font-semibold rounded-2xl
                    hover:bg-gray-200 dark:hover:bg-gray-700
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    active:scale-[0.98]
                  "
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConnect}
                  disabled={!selectedCalendar || isConnecting}
                  className="
                    flex-1 flex items-center justify-center gap-2.5
                    px-6 py-3.5
                    bg-gradient-to-r from-blue-500 to-blue-600
                    hover:from-blue-600 hover:to-blue-700
                    text-white font-semibold rounded-2xl
                    shadow-lg shadow-blue-500/30
                    hover:shadow-xl hover:shadow-blue-500/40
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                    active:scale-[0.98]
                  "
                >
                  {isConnecting ? (
                    <>
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span>Conectar calendario</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="mt-6 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-800/50 p-5">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                Sincronizacion automatica
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Los tratamientos programados se agregaran automaticamente al calendario seleccionado. Podras ver y gestionar tus citas desde Google Calendar.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Al conectar, autorizas a Laralis a crear y modificar eventos en tu calendario
          </p>
        </div>
      </div>
    </div>
  )
}
