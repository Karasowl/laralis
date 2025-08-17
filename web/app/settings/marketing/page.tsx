import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import MarketingSettingsClient from './MarketingSettingsClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export default async function MarketingSettingsPage() {
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.marketing.title')}
        subtitle={t('settings.marketing.subtitle')}
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}> 
        <MarketingSettingsClient />
      </Suspense>
    </div>
  );
}


