/**
 * Snapshots Settings Page
 *
 * Clinic-level backup and restore system.
 * Only clinic owners can create and restore snapshots.
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { AppLayout } from '@/components/layouts/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { SnapshotsClient } from './SnapshotsClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('snapshots')
  return {
    title: `${t('pageTitle')} - Laralis`,
    description: t('pageDescription'),
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function SnapshotsPage() {
  const t = await getTranslations('snapshots')

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Page Header */}
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          backHref="/settings"
        />

        {/* Content */}
        <div className="mt-8">
          <Suspense fallback={<LoadingSkeleton />}>
            <SnapshotsClient />
          </Suspense>
        </div>
      </div>
    </AppLayout>
  )
}
