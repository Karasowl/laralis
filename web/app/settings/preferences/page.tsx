'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { PreferencesClient } from './PreferencesClient';

export default function PreferencesPage() {
  const t = useTranslations('settings.preferences');

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />

        <Suspense
          fallback={
            <div className="grid gap-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          }
        >
          <PreferencesClient />
        </Suspense>
      </div>
    </AppLayout>
  );
}

