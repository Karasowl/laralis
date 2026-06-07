'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthForm } from '@/components/auth/AuthForm'
import { InputField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CONVEX_AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_BACKEND === 'convex'

// Convex Auth reset: enter the emailed OTP + a new password (reset-verification flow).
function ConvexResetForm() {
  const t = useTranslations('auth.resetPassword')
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const { confirmPasswordReset, loading } = useAuth()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (password.length < 6) {
      setErr(t('passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setErr(t('passwordsDontMatch'))
      return
    }
    if (!email || !code.trim()) return
    await confirmPasswordReset(email, code.trim(), password)
  }

  return (
    <AuthLayout showLogo={false}>
      <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold">{t('title')}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">{t('enterCodeAndPassword')}</p>
        </div>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('codePlaceholder')}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="text-center tracking-widest"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
          autoComplete="new-password"
        />
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t('confirmPasswordPlaceholder')}
          autoComplete="new-password"
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
        <Button type="submit" disabled={loading || !code.trim() || !password} className="w-full">
          {t('submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}

const resetPasswordSchema = z.object({
  password: z.string().min(6),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
})

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

function ResetPasswordContent() {
  if (CONVEX_AUTH_MODE) {
    return <ConvexResetForm />
  }
  return <SupabaseResetPasswordContent />
}

function SupabaseResetPasswordContent() {
  const t = useTranslations('auth.resetPassword')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)
  const [checking, setChecking] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur', // PERFORMANCE: Validate only on blur
  })

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createClient()
        
        // Parse the full URL including hash fragment
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = new URLSearchParams(window.location.search)
        
        // Check for errors in hash fragment (Supabase puts errors here)
        const hashError = hashParams.get('error')
        const hashErrorCode = hashParams.get('error_code')
        const hashErrorDescription = hashParams.get('error_description')
        
        // Also check query params as fallback
        const queryError = queryParams.get('error')
        const queryErrorDescription = queryParams.get('error_description')
        
        // Check if we have an error
        if (hashError || queryError) {
          const errorDesc = hashErrorDescription || queryErrorDescription || t('invalidCode')
          console.error('Auth error:', hashError || queryError, errorDesc)
          setErrorMessage(errorDesc)
          setIsValidSession(false)
          setChecking(false)
          return
        }
        
        // Check for access_token in hash (successful auth)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        if (accessToken && refreshToken) {
          // We have tokens, set the session
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          
          if (!sessionError) {
            setIsValidSession(true)
            setChecking(false)
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname)
            return
          } else {
            console.error('Session error:', sessionError)
          }
        }
        
        // Check if user is already authenticated (from previous flow)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          setIsValidSession(true)
          setChecking(false)
        } else {
          // No auth and no tokens
          setErrorMessage(t('noCode'))
          setIsValidSession(false)
          setChecking(false)
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        setErrorMessage(t('verificationError'))
        setIsValidSession(false)
        setChecking(false)
      }
    }

    handleAuthCallback()
  }, [t])

  const onSubmit = async (data: ResetPasswordForm) => {
    setLoading(true)

    try {
      const supabase = createClient()
      
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password
      })

      if (updateError) {
        console.error('Password update error:', updateError)
        toast.error(updateError.message || t('updateError'))
        setLoading(false)
        return
      }

      // Check if user has workspace to determine redirect
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email && process.env.NEXT_PUBLIC_CONVEX_AUTH_BRIDGE === '1') {
        await fetch('/api/auth/convex-bridge', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            password: data.password,
          }),
        }).catch((error) => {
          console.error('[reset-password] Convex auth bridge failed', error)
        })
      }

      setSuccess(true)
      toast.success(t('successMessage'))
      
      if (user) {
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)

        // Redirect after showing success message
        setTimeout(() => {
          if (!workspaces || workspaces.length === 0) {
            router.push('/onboarding')
          } else {
            router.push('/')
          }
        }, 2000)
      } else {
        // If no user, redirect to login
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('verificationError')
      console.error('Reset password error:', err)
      toast.error(errorMsg)
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <AuthLayout showLogo={false}>
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto" />
          <p className="text-xs sm:text-sm text-muted-foreground">{t('verifying')}</p>
        </div>
      </AuthLayout>
    )
  }

  if (!isValidSession) {
    return (
      <AuthLayout showLogo={false}>
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="inline-flex p-3 sm:p-4 bg-destructive/15 dark:bg-destructive/20/20 rounded-full">
            <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive dark:text-destructive/80" />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold">{t('errorTitle')}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {errorMessage || t('invalidCode')}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t('linkExpiration')}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/auth/forgot-password')}
            >
              {t('tryAgain')}
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout showLogo={false}>
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="inline-flex p-3 sm:p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
            <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold">{t('successTitle')}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('successDescription')}</p>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground">{t('redirecting')}</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout showLogo={false}>
      <AuthForm
        title={t('title')}
        description={t('description')}
        form={form}
        onSubmit={onSubmit}
        isSubmitting={loading}
        submitLabel={t('submit')}
      >
        <div className="space-y-3 sm:space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              label={t('passwordLabel')}
              type="password"
              placeholder={t('passwordPlaceholder')}
              {...form.register('password')}
              error={form.formState.errors.password?.message}
              required
              className="pl-10"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              label={t('confirmPasswordLabel')}
              type="password"
              placeholder={t('confirmPasswordPlaceholder')}
              {...form.register('confirmPassword')}
              error={form.formState.errors.confirmPassword?.message}
              required
              className="pl-10"
            />
          </div>
        </div>
      </AuthForm>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthLayout showLogo={false}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        </div>
      </AuthLayout>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
