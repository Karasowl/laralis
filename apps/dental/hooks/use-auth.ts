'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface AuthCredentials {
  email: string
  password: string
}

interface RegisterCredentials extends AuthCredentials {
  confirmPassword?: string
  firstName?: string
  lastName?: string
}

interface AuthState {
  loading: boolean
  error: string | null
}

interface UseAuthReturn extends AuthState {
  login: (credentials: AuthCredentials) => Promise<boolean>
  register: (credentials: RegisterCredentials) => Promise<boolean>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  clearError: () => void
}

export function useAuth(): UseAuthReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const t = useTranslations('auth')
  const supabase = useMemo(() => createClient(), [])

  const persistLocalePreference = useCallback((preferredLocale?: string | null) => {
    if (!preferredLocale) return
    try {
      document.cookie = `locale=${preferredLocale}; path=/; max-age=${60 * 60 * 24 * 365}`
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('preferred-locale', preferredLocale)
      }
    } catch (error) {
      console.error('[useAuth] Failed to persist locale', error)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const login = useCallback(async (credentials: AuthCredentials): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      if (getAuthBackend() === 'convex') {
        return await loginWithConvexCredentials(credentials, {
          setError,
          t,
          router,
        })
      }

      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (signInError) {
        if (getAuthBackend() === 'dual') {
          const convexLogin = await loginWithConvexCredentials(credentials, {
            setError,
            t,
            router,
            silent: true,
          })
          if (convexLogin) return true
        }

        setError(signInError.message)
        toast.error(signInError.message)
        return false
      }

      if (!data.user) {
        setError('Login failed - no user returned')
        toast.error('Login failed - no user returned')
        return false
      }

      await bridgeConvexPasswordCredential(credentials)

      const preferredLanguage = (data.user.user_metadata as Record<string, any> | null)?.preferred_language as string | undefined
      if (preferredLanguage) {
        persistLocalePreference(preferredLanguage)
      } else if (typeof window !== 'undefined') {
        const storedLocale = window.localStorage.getItem('preferred-locale')
        if (storedLocale) {
          persistLocalePreference(storedLocale)
          try {
            await supabase.auth.updateUser({ data: { preferred_language: storedLocale } })
          } catch (error) {
            console.error('[useAuth] Failed to sync stored locale to user metadata', error)
          }
        }
      }

      toast.success(t('login_success'))
      
      // Refresh the router to update the session in middleware
      // Then do a hard navigation to ensure everything is updated
      router.refresh()
      
      // Small delay to ensure cookies are set
      setTimeout(() => {
        window.location.href = '/'
      }, 500)
      
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed'
      setError(errorMsg)
      toast.error(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }, [supabase, t, router, persistLocalePreference])

  const register = useCallback(async (credentials: RegisterCredentials): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      // Validate passwords match
      if (credentials.password !== credentials.confirmPassword) {
        setError(t('passwords_dont_match'))
        return false
      }

      const fullName = `${credentials.firstName || ''} ${credentials.lastName || ''}`.trim()
      const cookieLocale = typeof document !== 'undefined'
        ? document.cookie.split('; ').find(part => part.startsWith('locale='))?.split('=')[1]
        : undefined

      const { error: signUpError, data } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            first_name: credentials.firstName,
            last_name: credentials.lastName,
            full_name: fullName,
            preferred_language: cookieLocale
          },
          // IMPORTANT: Tell Supabase where to redirect after email confirmation
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (signUpError) {
        const existingAccountError = /already registered|already exists|user already/i.test(signUpError.message)
        const message = existingAccountError ? t('errors.emailExists') : signUpError.message
        setError(message)
        toast.error(message)
        return false
      }

      const existingAccount = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
      if (existingAccount) {
        const message = t('errors.emailExists')
        setError(message)
        toast.error(message)
        return false
      }

      if (!data.user) {
        const message = t('errors.signUpError')
        setError(message)
        toast.error(message)
        return false
      }

      // Don't show toast here, the verify-email page will show all the info
      // toast.success(t('register_success'))

      const preferredLanguage = cookieLocale || (data.user?.user_metadata as Record<string, any> | null)?.preferred_language
      if (preferredLanguage && data.session) {
        persistLocalePreference(preferredLanguage)
        try {
          await supabase.auth.updateUser({ data: { preferred_language: preferredLanguage } })
        } catch (error) {
          console.error('[useAuth] Failed to persist preferred language after registration', error)
        }
      } else if (preferredLanguage) {
        persistLocalePreference(preferredLanguage)
      }

      if (data.session) {
        router.refresh()
        setTimeout(() => {
          window.location.href = '/'
        }, 500)
      } else {
        router.push(`/auth/verify-email?email=${encodeURIComponent(credentials.email)}`)
      }

      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Registration failed'
      setError(errorMsg)
      toast.error(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }, [supabase, router, t, persistLocalePreference])

  const logout = useCallback(async () => {
    setLoading(true)
    
    try {
      await supabase.auth.signOut()
      await fetch('/api/auth/convex-logout', { method: 'POST' }).catch(() => null)
      toast.success(t('logout_success'))
      router.push('/auth/login')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Logout failed'
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, t, persistLocalePreference])

  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (resetError) {
        setError(resetError.message)
        toast.error(resetError.message)
        return false
      }

      toast.success(t('reset_email_sent'))
      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Reset failed'
      setError(errorMsg)
      toast.error(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }, [supabase, t])

  return {
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    clearError
  }
}

async function bridgeConvexPasswordCredential(credentials: AuthCredentials) {
  if (process.env.NEXT_PUBLIC_CONVEX_AUTH_BRIDGE !== '1') return

  try {
    await fetch('/api/auth/convex-bridge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })
  } catch (error) {
    console.error('[useAuth] Convex auth bridge failed', error)
  }
}

function getAuthBackend() {
  const value = process.env.NEXT_PUBLIC_AUTH_BACKEND || 'supabase'
  return value === 'convex' || value === 'dual' ? value : 'supabase'
}

async function loginWithConvexCredentials(
  credentials: AuthCredentials,
  options: {
    setError: (message: string | null) => void
    t: (key: string) => string
    router: ReturnType<typeof useRouter>
    silent?: boolean
  }
) {
  try {
    const response = await fetch('/api/auth/convex-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })

    if (!response.ok) {
      if (!options.silent) {
        const body = await response.json().catch(() => null)
        const message = body?.error || 'Login failed'
        options.setError(message)
        toast.error(message)
      }
      return false
    }

    toast.success(options.t('login_success'))
    options.router.refresh()

    setTimeout(() => {
      window.location.href = '/'
    }, 500)

    return true
  } catch (error) {
    if (!options.silent) {
      const message = error instanceof Error ? error.message : 'Login failed'
      options.setError(message)
      toast.error(message)
    }
    return false
  }
}
