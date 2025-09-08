'use client'

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import WorkspacesClinicsSettingsClient from './WorkspacesClinicsSettingsClient'
import { AppLayout } from '@/components/layouts/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'

export default function WorkspacesPage() {
  const t = useTranslations()
  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.workspaces.title')}
          subtitle={t('settings.workspaces.description')}
        />
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <WorkspacesClinicsSettingsClient />
        </Suspense>
      </div>
    </AppLayout>
  )
}
