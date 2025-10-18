'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Mail, CheckCircle, RefreshCw, ArrowLeft, Clock, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail')
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const [resending, setResending] = useState(false)
  const [resendCount, setResendCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const supabase = createClient()

  // Timer for resend cooldown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft])

  const handleResend = async () => {
    if (!email || resending || timeLeft > 0) return

    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })

      if (error) {
        toast.error(t('resendError'))
      } else {
        toast.success(t('resendSuccess'))
        setResendCount(resendCount + 1)
        setTimeLeft(60) // 60 second cooldown
      }
    } catch (error) {
      toast.error(t('resendError'))
    } finally {
      setResending(false)
    }
  }

  const handleBackToLogin = () => {
    router.push('/auth/login')
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Main Card with prominent styling */}
        <Card className="border-2 border-primary/20 shadow-xl bg-gradient-to-br from-background to-primary/5">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-bold">{t('title')}</CardTitle>
            <CardDescription className="text-lg mt-2">
              {t('subtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* Success Alert */}
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-900 text-lg">
                {t('successTitle')}
              </AlertTitle>
              <AlertDescription className="text-green-800 mt-2">
                <p className="font-semibold text-base mb-2">
                  {email ? t('sentTo', { email }) : t('checkInbox')}
                </p>
                <p className="text-sm">
                  {t('instructions')}
                </p>
              </AlertDescription>
            </Alert>

            {/* Step by step instructions */}
            <div className="bg-muted/30 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                {t('whatToDo')}
              </h3>

              <ol className="space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </span>
                  <div className="pt-0.5">
                    <p className="font-medium">{t('step1Title')}</p>
                    <p className="text-sm text-muted-foreground">{t('step1Description')}</p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </span>
                  <div className="pt-0.5">
                    <p className="font-medium">{t('step2Title')}</p>
                    <p className="text-sm text-muted-foreground">{t('step2Description')}</p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </span>
                  <div className="pt-0.5">
                    <p className="font-medium">{t('step3Title')}</p>
                    <p className="text-sm text-muted-foreground">{t('step3Description')}</p>
                  </div>
                </li>
              </ol>
            </div>

            {/* Important notes */}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>{t('importantTitle')}</AlertTitle>
              <AlertDescription className="space-y-2 mt-2">
                <p>{t('checkSpam')}</p>
                <p className="text-sm">{t('linkExpiry')}</p>
              </AlertDescription>
            </Alert>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleResend}
                disabled={resending || timeLeft > 0}
                variant="default"
                className="flex-1"
              >
                {resending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    {t('resending')}
                  </>
                ) : timeLeft > 0 ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    {t('waitTime', { seconds: timeLeft })}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('resendEmail')}
                  </>
                )}
              </Button>

              <Button
                onClick={handleBackToLogin}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToLogin')}
              </Button>
            </div>

            {resendCount > 0 && (
              <p className="text-sm text-center text-muted-foreground">
                {t('resendAttempts', { count: resendCount })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Additional help card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('needHelp')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t('commonIssues')}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{t('issue1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{t('issue2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{t('issue3')}</span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-4">
              {t('contactSupport')}{' '}
              <a href={`mailto:${t('supportEmail')}`} className="text-primary hover:underline">
                {t('supportEmail')}
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  )
}