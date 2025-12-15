'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationsClient } from './NotificationsClient';

export default function NotificationsPage() {
  const t = useTranslations('settings.notifications');

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
        <PageHeader title={t('title')} subtitle={t('description')} backHref="/settings" />

        <Suspense
          fallback={
            <div className="grid gap-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          }
        >
          <NotificationsClient />
        </Suspense>
      </div>
    </AppLayout>
  );
}
