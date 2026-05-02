'use client'

import React, { useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthForm } from '@/components/auth/AuthForm'
import { InputField } from '@/components/ui/form-field'
import { useAuth } from '@/hooks/use-auth'
import { Mail, Lock, User, Check } from 'lucide-react'

type RegisterFormData = {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

// PERFORMANCE FIX: Memoized password strength indicator
const PasswordStrength = React.memo(function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations('auth.register')

  // PERFORMANCE: Memoize expensive checks calculation
  const checks = useMemo(() => [
    { label: t('passwordMinLength'), valid: password.length >= 8 },
    { label: t('passwordUppercase'), valid: /[A-Z]/.test(password) },
    { label: t('passwordLowercase'), valid: /[a-z]/.test(password) },
    { label: t('passwordNumber'), valid: /[0-9]/.test(password) }
  ], [password, t])

  const strength = useMemo(() => checks.filter(c => c.valid).length, [checks])

  const strengthLabel = useMemo(() =>
    strength === 0 ? '' :
    strength === 1 ? t('weak') :
    strength === 2 ? t('fair') :
    strength === 3 ? t('good') :
    t('strong')
  , [strength, t])

  const strengthColor = useMemo(() =>
    strength === 0 ? 'bg-muted' :
    strength === 1 ? 'bg-destructive' :
    strength === 2 ? 'bg-amber-500' :
    strength === 3 ? 'bg-primary' :
    'bg-emerald-500'
  , [strength])

  if (!password) return null

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${strengthColor}`}
            style={{ width: `${(strength / 4) * 100}%` }}
          />
        </div>
        {strengthLabel && (
          <span className="text-xs text-muted-foreground">{strengthLabel}</span>
        )}
      </div>
      
      <div className="space-y-1">
        {checks.map((check, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className={`rounded-full p-0.5 ${
              check.valid ? 'bg-emerald-500' : 'bg-muted'
            }`}>
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
            <span className={`text-xs ${
              check.valid ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'
            }`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})

export default function RegisterPage() {
  const t = useTranslations('auth.register')
  const tValidation = useTranslations('validation')
  const router = useRouter()
  const { register, loading, error, clearError } = useAuth()

  // Create schema with translated messages
  const registerSchema = z.object({
    firstName: z.string().min(2, tValidation('required')),
    lastName: z.string().min(2, tValidation('required')),
    email: z.string().email(tValidation('email')),
    password: z.string()
      .min(8, tValidation('passwordMinLength8'))
      .regex(/[A-Z]/, tValidation('passwordUppercase'))
      .regex(/[a-z]/, tValidation('passwordLowercase'))
      .regex(/[0-9]/, tValidation('passwordNumber')),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine(val => val === true, {
      message: tValidation('acceptTerms')
    })
  }).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: tValidation('passwordsNoMatch')
  })

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false
    },
    mode: 'onBlur', // PERFORMANCE: Validate only on blur
  })

  // PERFORMANCE FIX: Use useWatch instead of form.watch for better performance
  const password = useWatch({ control: form.control, name: 'password', defaultValue: '' })

  // Clear error when form values change
  useEffect(() => {
    const subscription = form.watch(() => clearError())
    return () => subscription.unsubscribe()
  }, [form, clearError])

  const onSubmit = async (data: RegisterFormData) => {
    const success = await register({
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      firstName: data.firstName,
      lastName: data.lastName
    })

    // The register function will handle the redirect to verify-email page
    // if (success) {
    //   router.push('/auth/verify-email')
    // }
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
          text: t('haveAccount'),
          linkText: t('signIn'),
          linkHref: '/auth/login'
        }}
        error={error}
      >
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
            <div className="relative">
              <User className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
              <InputField
                type="text"
                label={t('firstName')}
                placeholder={t('firstNamePlaceholder')}
                value={form.watch('firstName')}
                onChange={(e) => {
                  const val = typeof e === 'object' && 'target' in e ? e.target.value : e
                  form.setValue('firstName', val as string)
                }}
                error={form.formState.errors.firstName?.message}
                className="pl-10"
                required
              />
            </div>

            <div className="relative">
              <User className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
              <InputField
                type="text"
                label={t('lastName')}
                placeholder={t('lastNamePlaceholder')}
                value={form.watch('lastName')}
                onChange={(e) => {
                  const val = typeof e === 'object' && 'target' in e ? e.target.value : e
                  form.setValue('lastName', val as string)
                }}
                error={form.formState.errors.lastName?.message}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              type="email"
              label={t('email')}
              placeholder={t('emailPlaceholder')}
              value={form.watch('email')}
              onChange={(e) => {
                const val = typeof e === 'object' && 'target' in e ? e.target.value : e
                form.setValue('email', val as string)
              }}
              error={form.formState.errors.email?.message}
              className="pl-10"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
              <InputField
                type="password"
                label={t('password')}
                placeholder={t('passwordPlaceholder')}
                value={form.watch('password')}
                onChange={(e) => {
                  const val = typeof e === 'object' && 'target' in e ? e.target.value : e
                  form.setValue('password', val as string)
                }}
                error={form.formState.errors.password?.message}
                className="pl-10"
                required
              />
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-7 sm:top-8 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              type="password"
              label={t('confirmPassword')}
              placeholder={t('confirmPasswordPlaceholder')}
              value={form.watch('confirmPassword')}
              onChange={(e) => {
                const val = typeof e === 'object' && 'target' in e ? e.target.value : e
                form.setValue('confirmPassword', val as string)
              }}
              error={form.formState.errors.confirmPassword?.message}
              className="pl-10"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-start space-x-2">
              <input
                type="checkbox"
                className="rounded mt-0.5 h-4 w-4"
                checked={form.watch('acceptTerms')}
                onChange={(e) => form.setValue('acceptTerms', e.target.checked)}
              />
              <span className="text-xs sm:text-sm text-muted-foreground">
                {t('agreeToTerms')}{' '}
                <a href="/terms" className="text-primary hover:underline">
                  {t('termsOfService')}
                </a>{' '}
                {t('and')}{' '}
                <a href="/privacy" className="text-primary hover:underline">
                  {t('privacyPolicy')}
                </a>
              </span>
            </label>
            {form.formState.errors.acceptTerms && (
              <p className="text-xs text-destructive">{form.formState.errors.acceptTerms.message}</p>
            )}
          </div>
        </div>
      </AuthForm>
    </AuthLayout>
  )
}
