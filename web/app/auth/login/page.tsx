'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthForm } from '@/components/auth/AuthForm'
import { InputField } from '@/components/ui/form-field'
import { useAuth } from '@/hooks/use-auth'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

type LoginFormData = {
  email: string
  password: string
}

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const tValidation = useTranslations('validation')
  const router = useRouter()
  const { login, loading, error, clearError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  // Schema for login form with translated messages
  const loginSchema = z.object({
    email: z.string().email(tValidation('email')),
    password: z.string().min(6, tValidation('passwordMinLength6'))
  })

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  // Clear error when form values change
  useEffect(() => {
    const subscription = form.watch(() => clearError())
    return () => subscription.unsubscribe()
  }, [form, clearError])

  const onSubmit = async (data: LoginFormData) => {
    const success = await login(data)
    if (success) {
      // Login successful, will redirect via window.location
    }
  }

  return (
    <AuthLayout>
      <AuthForm
        title={t('title')}
        description={t('description')}
        form={form}
        onSubmit={onSubmit}
        isSubmitting={loading}
        submitLabel={t('submit')}
        footer={{
          text: t('noAccount'),
          linkText: t('signUp'),
          linkHref: '/auth/register'
        }}
        error={error}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('email')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                placeholder={t('emailPlaceholder')}
                {...form.register('email')}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-10 mt-1 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('password')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('passwordPlaceholder')}
                {...form.register('password')}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-10 pr-12 mt-1 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-1/2 -translate-y-1/2 h-10 px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
                <span className="sr-only">
                  {showPassword ? t('hidePassword') : t('showPassword')}
                </span>
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <label htmlFor="remember" className="text-sm text-muted-foreground">
                {t('rememberMe')}
              </label>
            </div>

            <a
              href="/auth/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              {t('forgotPassword')}
            </a>
          </div>
        </div>
      </AuthForm>
    </AuthLayout>
  )
}