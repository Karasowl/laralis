'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Mail, CheckCircle, RefreshCw, ArrowLeft, Clock } from 'lucide-react'
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
      // IMPORTANT: Include emailRedirectTo so Supabase knows where to send users after clicking the link
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        console.error('[verify-email] Resend error:', error)
        toast.error(t('resendError'))
      } else {
        toast.success(t('resendSuccess'))
        setResendCount(resendCount + 1)
        setTimeLeft(60) // 60 second cooldown
      }
    } catch (error) {
      console.error('[verify-email] Resend exception:', error)
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
      <div className="w-full max-w-md mx-auto px-4">
        <Card className="border-2 border-primary/20 dark:border-primary/30 shadow-xl bg-card dark:bg-card">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary dark:text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-foreground">{t('title')}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {email ? t('sentTo', { email }) : t('checkInbox')}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            {/* Action buttons - Vertical stack always */}
            <div className="flex flex-col gap-3 w-full">
              <Button
                onClick={handleResend}
                disabled={resending || timeLeft > 0}
                variant="default"
                className="w-full justify-center"
                size="default"
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
                className="w-full justify-center"
                size="default"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToLogin')}
              </Button>
            </div>

            {resendCount > 0 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                {t('resendAttempts', { count: resendCount })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  )
}
