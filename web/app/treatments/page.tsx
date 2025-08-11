"use client";
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText } from 'lucide-react';

export default function TreatmentsPage() {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('nav.treatments')}
        subtitle={t('treatments.subtitle')}
      />
      
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title={t('treatments.empty.title')}
        description={t('treatments.empty.description')}
      />
    </div>
  );
}