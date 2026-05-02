'use client'

import { useSearchParams, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle, Calendar, Clock, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function BookingConfirmationPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const t = useTranslations('booking')

  const slug = params.slug as string
  const bookingId = searchParams.get('id')

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {t('confirmation.title')}
          </h1>

          <p className="text-gray-600 mb-6">
            {t('confirmation.subtitle')}
          </p>

          {/* Info Cards */}
          <div className="space-y-3 text-left mb-6">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{t('confirmation.pending')}</p>
                <p className="text-sm text-gray-500">{t('confirmation.pendingDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{t('confirmation.email')}</p>
                <p className="text-sm text-gray-500">{t('confirmation.emailDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{t('confirmation.reminder')}</p>
                <p className="text-sm text-gray-500">{t('confirmation.reminderDesc')}</p>
              </div>
            </div>
          </div>

          {/* Reference Number */}
          {bookingId && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-700">
                {t('confirmation.reference')}: <span className="font-mono font-semibold">{bookingId.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Link href={`/book/${slug}`}>
                {t('confirmation.bookAnother')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
