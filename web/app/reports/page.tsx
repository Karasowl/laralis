"use client";
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { TrendingUp } from 'lucide-react';

export default function ReportsPage() {
  const t = useTranslations();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('nav.reports')}
        subtitle={t('reports.subtitle')}
      />
      
      <EmptyState
        icon={<TrendingUp className="h-8 w-8" />}
        title={t('reports.empty.title')}
        description={t('reports.empty.description')}
      />
    </div>
  );
}