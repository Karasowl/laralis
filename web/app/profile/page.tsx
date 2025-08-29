'use client';

import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { 
  User,
  Settings,
  Shield,
  Bell,
  Globe,
  Moon,
  ChevronRight,
  Mail,
  Phone
} from 'lucide-react';
import { ProfileClient } from './ProfileClient';
import { useWorkspace } from '@/contexts/workspace-context';

export default function ProfilePage() {
  const t = useTranslations();
  const { user } = useWorkspace();

  const profileSections = [
    {
      title: t('profile.personalInfo'),
      icon: User,
      items: [
        { 
          label: t('profile.fullName'), 
          value: user?.user_metadata?.full_name || 
                 `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() || 
                 t('profile.noName')
        },
        { label: t('profile.email'), value: user?.email || t('profile.noEmail'), icon: Mail },
        { label: t('profile.phone'), value: user?.user_metadata?.phone || t('profile.noPhone'), icon: Phone },
      ]
    },
    {
      title: t('profile.preferences'),
      icon: Settings,
      items: [
        { label: t('profile.language'), value: t('profile.spanish'), icon: Globe },
        { label: t('profile.theme'), value: t('profile.systemTheme'), icon: Moon },
        { label: t('profile.notifications'), value: t('profile.enabled'), icon: Bell },
      ]
    },
    {
      title: t('profile.security'),
      icon: Shield,
      items: [
        { label: t('profile.lastLogin'), value: 'Hace 2 horas' },
        { label: t('profile.twoFactor'), value: t('profile.disabled') },
      ]
    }
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('profile.title')}
          subtitle={t('profile.subtitle')}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Summary Card */}
          <Card className="lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center mb-4">
                  <User className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-xl font-semibold mb-1">
                  {user?.user_metadata?.full_name || 
                   `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() || 
                   t('profile.defaultUser')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {user?.email}
                </p>
                <div className="w-full pt-4 border-t">
                  <ProfileClient user={user} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {profileSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.title}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg">{section.title}</h3>
                    </div>
                    <div className="space-y-3">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <div 
                            key={item.label} 
                            className="flex items-center justify-between py-2"
                          >
                            <div className="flex items-center gap-3">
                              {ItemIcon && (
                                <ItemIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm text-muted-foreground">
                                {item.label}
                              </span>
                            </div>
                            <span className="text-sm font-medium">
                              {item.value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}