'use client'

import { useTranslations } from 'next-intl'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PermissionGate } from '@/components/auth'
import InboxClient from './InboxClient'

export default function InboxPage() {
  const t = useTranslations('inbox')

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <PermissionGate permission="inbox.view" fallbackType="message">
          <InboxClient />
        </PermissionGate>
      </div>
    </AppLayout>
  )
}
