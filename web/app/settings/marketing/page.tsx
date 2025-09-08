'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import MarketingSettingsClient from './MarketingSettingsClient';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function MarketingSettingsPage() {
  const t = useTranslations();

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.marketing.title')}
          subtitle={t('settings.marketing.subtitle')}
        />
        <Suspense fallback={<Skeleton className="h-64 w-full" />}> 
          <MarketingSettingsClient />
        </Suspense>
      </div>
    </AppLayout>
  );
}