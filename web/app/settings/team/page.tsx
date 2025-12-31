import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { TeamPageClient } from './TeamPageClient';

export default async function TeamSettingsPage() {
  const t = await getTranslations('team');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <TeamPageClient />
    </div>
  );
}
