'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Building,
  Building2,
  Clock, 
  Calculator, 
  DollarSign,
  Package,
  Wrench,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Download,
  Upload,
  Megaphone
} from 'lucide-react';

export default function SettingsPage() {
  const t = useTranslations();

  const settingsSections = [
    {
      id: 'workspaces',
      title: t('settings.workspaces.title'),
      description: t('settings.workspaces.subtitle'),
      href: '/settings/workspaces',
      icon: Building2,
      color: 'text-blue-600'
    },
    {
      id: 'clinics',
      title: t('settings.clinics.title'),
      description: t('settings.clinics.description'),
      href: '/settings/workspaces', // Clinics now live under Workspaces
      icon: Building,
      color: 'text-emerald-600'
    },
    {
      id: 'time',
      title: t('settings.time.title'),
      description: t('settings.time.description'),
      href: '/time',
      icon: Clock,
      color: 'text-purple-600'
    },
    {
      id: 'tariffs',
      title: t('settings.tariffs.title'),
      description: t('settings.tariffs.description'),
      href: '/tariffs',
      icon: Calculator,
      color: 'text-orange-600'
    },
    {
      id: 'marketing',
      title: t('settings.marketing.title'),
      description: t('settings.marketing.description'),
      href: '/settings/marketing',
      icon: Megaphone,
      color: 'text-pink-600'
    },
    {
      id: 'fixed-costs',
      title: t('settings.fixedCosts.title'),
      description: t('settings.fixedCosts.description'),
      href: '/fixed-costs',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      id: 'assets',
      title: t('settings.assets.title'),
      description: t('settings.assets.description'),
      href: '/assets',
      icon: Wrench,
      color: 'text-indigo-600'
    },
    {
      id: 'supplies',
      title: t('settings.supplies.title'),
      description: t('settings.supplies.description'),
      href: '/supplies',
      icon: Package,
      color: 'text-yellow-600'
    },
    {
      id: 'reports',
      title: t('settings.reports.title'),
      description: t('settings.reports.description'),
      href: '/reports',
      icon: TrendingUp,
      color: 'text-cyan-600'
    },
    {
      id: 'reset',
      title: t('settings.reset.title'),
      description: t('settings.reset.description'),
      href: '/settings/reset',
      icon: RefreshCw,
      color: 'text-red-600'
    }
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.title')}
          subtitle={t('settings.subtitle')}
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.id} href={section.href}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg bg-muted ${section.color} bg-opacity-10`}>
                            <Icon className={`h-5 w-5 ${section.color}`} />
                          </div>
                          <h3 className="font-semibold text-lg">
                            {section.title}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Download className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{t('settings.backup.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.backup.description')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {t('settings.backup.import')}
                </button>
                <button className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors inline-flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t('settings.backup.export')}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
