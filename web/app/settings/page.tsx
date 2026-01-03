'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import {
  UserCog,
  SlidersHorizontal,
  ShieldCheck,
  Building2,
  Users,
  RefreshCw,
  ChevronRight,
  PackageOpen,
  Calendar,
  Mail,
  Archive,
} from 'lucide-react';

export default function SettingsPage() {
  const t = useTranslations();

  const settingsGroups = [
    {
      id: 'personal',
      title: t('settings.groups.personal.title'),
      subtitle: t('settings.groups.personal.subtitle'),
      items: [
        {
          id: 'account',
          title: t('settings.account.cardTitle'),
          description: t('settings.account.cardDescription'),
          href: '/settings/account',
          icon: UserCog,
          color: 'text-sky-600',
        },
        {
          id: 'preferences',
          title: t('settings.preferences.cardTitle'),
          description: t('settings.preferences.cardDescription'),
          href: '/settings/preferences',
          icon: SlidersHorizontal,
          color: 'text-violet-600',
        },
        {
          id: 'security',
          title: t('settings.security.cardTitle'),
          description: t('settings.security.cardDescription'),
          href: '/settings/security',
          icon: ShieldCheck,
          color: 'text-emerald-600',
        },
      ],
    },
    {
      id: 'organization',
      title: t('settings.groups.organization.title'),
      subtitle: t('settings.groups.organization.subtitle'),
      items: [
        {
          id: 'workspaces',
          title: t('settings.workspaces.title'),
          description: t('settings.workspaces.subtitle'),
          href: '/settings/workspaces',
          icon: Building2,
          color: 'text-primary',
        },
        {
          id: 'team',
          title: t('settings.team.title'),
          description: t('settings.team.description'),
          href: '/settings/team',
          icon: Users,
          color: 'text-indigo-600',
        },
      ],
    },
    {
      id: 'integrations',
      title: t('settings.groups.integrations.title'),
      subtitle: t('settings.groups.integrations.subtitle'),
      items: [
        {
          id: 'calendar',
          title: t('settings.calendar.cardTitle'),
          description: t('settings.calendar.cardDescription'),
          href: '/settings/calendar',
          icon: Calendar,
          color: 'text-blue-600',
        },
        {
          id: 'notifications',
          title: t('settings.notifications.title'),
          description: t('settings.notifications.description'),
          href: '/settings/notifications',
          icon: Mail,
          color: 'text-amber-600',
        },
      ],
    },
    {
      id: 'maintenance',
      title: t('settings.groups.maintenance.title'),
      subtitle: t('settings.groups.maintenance.subtitle'),
      items: [
        {
          id: 'snapshots',
          title: t('settings.snapshots.title'),
          description: t('settings.snapshots.description'),
          href: '/settings/snapshots',
          icon: Archive,
          color: 'text-teal-600',
        },
        {
          id: 'export-import',
          title: t('settings.exportImport.title'),
          description: t('settings.exportImport.description'),
          href: '/settings/export-import',
          icon: PackageOpen,
          color: 'text-purple-600',
        },
        {
          id: 'reset',
          title: t('settings.reset.title'),
          description: t('settings.reset.description'),
          href: '/settings/reset',
          icon: RefreshCw,
          color: 'text-destructive',
        },
      ],
    },
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('settings.title')}
          subtitle={t('settings.subtitle')}
        />

        <div className="space-y-8">
          {settingsGroups.map((group) => (
            <section key={group.id} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{group.title}</h2>
                <p className="text-sm text-muted-foreground">{group.subtitle}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} href={item.href}>
                      <Card className="group h-full cursor-pointer transition-all duration-200 hover:shadow-lg">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-2 flex items-center gap-3">
                                <div className={`rounded-lg bg-muted p-2 bg-opacity-10 ${item.color}`}>
                                  <Icon className={`h-5 w-5 ${item.color}`} />
                                </div>
                                <h3 className="text-lg font-semibold">{item.title}</h3>
                              </div>
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                            <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
