/**
 * Export/Import Settings Page
 *
 * Allows workspace owners and super_admins to export and import data.
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { ExportSection } from './components/ExportSection';
import { ImportSection } from './components/ImportSection';
import { Database, Download, Upload } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('export');
  return {
    title: `${t('title')} / ${t('import.title')} - Laralis`,
    description: t('description'),
  };
}

export default async function ExportImportPage() {
  const t = await getTranslations('export');

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Page Header */}
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        icon={Database}
      />

      {/* Tabs */}
      <Tabs defaultValue="export" className="mt-8">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t('title')}
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t('import.title')}
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="mt-6">
          <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
            <ExportSection />
          </Suspense>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="mt-6">
          <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
            <ImportSection />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
