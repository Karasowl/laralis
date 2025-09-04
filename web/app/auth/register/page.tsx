'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthForm } from '@/components/auth/AuthForm'
import { InputField } from '@/components/ui/form-field'
import { useAuth } from '@/hooks/use-auth'
import { Mail, Lock, User, Check } from 'lucide-react'

// Schema for register form
const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true)
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"]
})

type RegisterFormData = z.infer<typeof registerSchema>

// Password strength indicator component
function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations('auth.register')
  
  const checks = [
    { label: t('passwordMinLength'), valid: password.length >= 8 },
    { label: t('passwordUppercase'), valid: /[A-Z]/.test(password) },
    { label: t('passwordLowercase'), valid: /[a-z]/.test(password) },
    { label: t('passwordNumber'), valid: /[0-9]/.test(password) }
  ]

  const strength = checks.filter(c => c.valid).length
  const strengthLabel = 
    strength === 0 ? '' :
    strength === 1 ? t('weak') :
    strength === 2 ? t('fair') :
    strength === 3 ? t('good') :
    t('strong')

  const strengthColor = 
    strength === 0 ? 'bg-gray-200' :
    strength === 1 ? 'bg-red-500' :
    strength === 2 ? 'bg-yellow-500' :
    strength === 3 ? 'bg-blue-500' :
    'bg-green-500'

  if (!password) return null

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
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
              check.valid ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
            <span className={`text-xs ${
              check.valid ? 'text-green-600' : 'text-muted-foreground'
            }`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const t = useTranslations('auth.register')
  const router = useRouter()
  const { register, loading, error, clearError } = useAuth()

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false
    }
  })

  const password = form.watch('password')

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
      name: `${data.firstName} ${data.lastName}`
    })
    
    if (success) {
      router.push('/onboarding')
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
          text: t('haveAccount'),
          linkText: t('signIn'),
          linkHref: '/auth/login'
        }}
        error={error}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <User className="absolute left-3 top-9 h-4 w-4 text-muted-foreground pointer-events-none" />
              <InputField
                type="text"
                label={t('firstName')}
                placeholder={t('firstNamePlaceholder')}
                value={form.watch('firstName')}
                onChange={(value) => form.setValue('firstName', value as string)}
                error={form.formState.errors.firstName?.message}
                className="pl-10"
                required
              />
            </div>

            <div className="relative">
              <User className="absolute left-3 top-9 h-4 w-4 text-muted-foreground pointer-events-none" />
              <InputField
                type="text"
                label={t('lastName')}
                placeholder={t('lastNamePlaceholder')}
                value={form.watch('lastName')}
                onChange={(value) => form.setValue('lastName', value as string)}
                error={form.formState.errors.lastName?.message}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-9 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              type="email"
              label={t('email')}
              placeholder={t('emailPlaceholder')}
              value={form.watch('email')}
              onChange={(value) => form.setValue('email', value as string)}
              error={form.formState.errors.email?.message}
              className="pl-10"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-9 h-4 w-4 text-muted-foreground pointer-events-none" />
              <InputField
                type="password"
                label={t('password')}
                placeholder={t('passwordPlaceholder')}
                value={form.watch('password')}
                onChange={(value) => form.setValue('password', value as string)}
                error={form.formState.errors.password?.message}
                className="pl-10"
                required
              />
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-9 h-4 w-4 text-muted-foreground pointer-events-none" />
            <InputField
              type="password"
              label={t('confirmPassword')}
              placeholder={t('confirmPasswordPlaceholder')}
              value={form.watch('confirmPassword')}
              onChange={(value) => form.setValue('confirmPassword', value as string)}
              error={form.formState.errors.confirmPassword?.message}
              className="pl-10"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-start space-x-2">
              <input 
                type="checkbox" 
                className="rounded mt-1" 
                checked={form.watch('acceptTerms')}
                onChange={(e) => form.setValue('acceptTerms', e.target.checked)}
              />
              <span className="text-sm text-muted-foreground">
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
              <p className="text-xs text-red-500">{form.formState.errors.acceptTerms.message}</p>
            )}
          </div>
        </div>
      </AuthForm>
    </AuthLayout>
  )
}