'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { SecuritySettingsClient } from './SecuritySettingsClient';

export default function SecuritySettingsPage() {
  const t = useTranslations('settings.security');

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 mx-auto max-w-[1200px] space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-56 w-full md:col-span-2" />
            </div>
          }
        >
          <SecuritySettingsClient />
        </Suspense>
      </div>
    </AppLayout>
  );
}

