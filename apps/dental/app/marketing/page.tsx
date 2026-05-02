'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import MarketingSettingsClient from '@/app/settings/marketing/MarketingSettingsClient';

export default function MarketingPage() {
  const t = useTranslations('settings.marketing');

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <MarketingSettingsClient />
        </Suspense>
      </div>
    </AppLayout>
  );
}

