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
  name?: string
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

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const login = useCallback(async (credentials: AuthCredentials): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const { error: signInError, data } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (signInError) {
        setError(signInError.message)
        toast.error(signInError.message)
        return false
      }

      if (!data.user) {
        setError('Login failed - no user returned')
        toast.error('Login failed - no user returned')
        return false
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
  }, [supabase, t, router])

  const register = useCallback(async (credentials: RegisterCredentials): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      // Validate passwords match
      if (credentials.password !== credentials.confirmPassword) {
        setError(t('passwords_dont_match'))
        return false
      }

      const { error: signUpError, data } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: { name: credentials.name }
        }
      })

      if (signUpError) {
        setError(signUpError.message)
        toast.error(signUpError.message)
        return false
      }

      toast.success(t('register_success'))
      
      // Auto-login after registration
      if (data.user) {
        router.push('/onboarding')
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
  }, [supabase, router, t])

  const logout = useCallback(async () => {
    setLoading(true)
    
    try {
      await supabase.auth.signOut()
      toast.success(t('logout_success'))
      router.push('/auth/login')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Logout failed'
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, t])

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