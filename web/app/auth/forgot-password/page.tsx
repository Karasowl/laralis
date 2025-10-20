'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthForm } from '@/components/auth/AuthForm'
import { InputField } from '@/components/ui/form-field'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/use-auth'
import { Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword')
  const router = useRouter()
  const { resetPassword, loading } = useAuth()
  const [emailSent, setEmailSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onBlur', // PERFORMANCE: Validate only on blur
  })

  const onSubmit = async (data: ForgotPasswordForm) => {
    const success = await resetPassword(data.email)
    if (success) {
      setSubmittedEmail(data.email)
      setEmailSent(true)
    }
  }

  if (emailSent) {
    return (
      <AuthLayout showLogo={false}>
        <div className="text-center space-y-6">
          <div className="inline-flex p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
            <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{t('emailSentTitle')}</h2>
            <p className="text-muted-foreground">
              {t('emailSentDescription', { email: submittedEmail })}
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('checkSpam')}
            </p>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/auth/login')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToLogin')}
            </Button>
          </div>
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
        footer={{
          text: t('rememberPassword'),
          linkText: t('backToLogin'),
          linkHref: '/auth/login',
        }}
      >
        <div className="relative">
          <Mail className="absolute left-3 top-9 h-4 w-4 text-muted-foreground pointer-events-none" />
          <InputField
            label={t('emailLabel')}
            type="email"
            placeholder={t('emailPlaceholder')}
            {...form.register('email')}
            error={form.formState.errors.email?.message}
            required
            className="pl-10"
          />
        </div>
      </AuthForm>
    </AuthLayout>
  )
}