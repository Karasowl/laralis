'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { AppLayout } from '@/components/layouts/AppLayout';
import { TeamPageClient } from './TeamPageClient';

export default function TeamSettingsPage() {
  const t = useTranslations('team');

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('title')}
          description={t('description')}
          backHref="/settings"
        />
        <TeamPageClient />
      </div>
    </AppLayout>
  );
}
