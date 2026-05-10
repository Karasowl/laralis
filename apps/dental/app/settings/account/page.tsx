'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { User } from 'lucide-react';
import { useWorkspace } from '@/contexts/workspace-context';
import { ProfileClient } from '@/app/profile/ProfileClient';

type PreferenceSummary = {
  locale: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
};

export default function AccountSettingsPage() {
  const t = useTranslations('settings.account');
  const tProfile = useTranslations('profile');
  const tPreferences = useTranslations('settings.preferences');
  const { user } = useWorkspace();

  const [preferences, setPreferences] = useState<PreferenceSummary | null>(null);
  const [loadingPreferences, setLoadingPreferences] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/settings/preferences');
        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }
        const json = await response.json();
        if (mounted) {
          setPreferences(json.data as PreferenceSummary);
        }
      } catch {
        if (mounted) {
          setPreferences(null);
        }
      } finally {
        if (mounted) {
          setLoadingPreferences(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  const fullName =
    user?.user_metadata?.full_name ||
    `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() ||
    tProfile('defaultUser');

  const languageLabel = useMemo(() => {
    if (!preferences) return null;
    const localeKey = preferences.locale === 'en' ? 'en' : 'es';
    return tPreferences(`language.options.${localeKey}`);
  }, [preferences, tPreferences]);

  const themeLabel = useMemo(() => {
    if (!preferences) return null;
    return tPreferences(`appearance.options.${preferences.theme}`);
  }, [preferences, tPreferences]);

  const notificationsLabel = useMemo(() => {
    if (!preferences) return null;
    const channels: string[] = [];
    if (preferences.notifications.email) {
      channels.push(tPreferences('notifications.channels.email.title'));
    }
    if (preferences.notifications.sms) {
      channels.push(tPreferences('notifications.channels.sms.title'));
    }
    if (preferences.notifications.push) {
      channels.push(tPreferences('notifications.channels.push.title'));
    }
    if (channels.length === 0) {
      return tPreferences('notifications.none');
    }
    return channels.join(' · ');
  }, [preferences, tPreferences]);

  const SummaryRow = ({
    label,
    value,
    loading,
  }: {
    label: string;
    value: string | null | undefined;
    loading?: boolean;
  }) => (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-4 w-28" />
      ) : (
        <p className="mt-1 text-sm font-medium text-foreground">
          {value || t('summary.notAvailable')}
        </p>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} backHref="/settings" />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center mb-4">
                  <User className="h-12 w-12 text-white" />
                </div>
                <div>
                  <p className="text-xl font-semibold">{fullName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <SummaryRow label={t('summary.email')} value={user?.email || tProfile('noEmail')} />
                <SummaryRow
                  label={t('summary.phone')}
                  value={user?.user_metadata?.phone || tProfile('noPhone')}
                />
                <SummaryRow
                  label={t('summary.language')}
                  value={languageLabel}
                  loading={loadingPreferences}
                />
                <SummaryRow
                  label={t('summary.timezone')}
                  value={preferences?.timezone}
                  loading={loadingPreferences}
                />
                <SummaryRow
                  label={t('summary.theme')}
                  value={themeLabel}
                  loading={loadingPreferences}
                />
                <SummaryRow
                  label={t('summary.notifications')}
                  value={notificationsLabel}
                  loading={loadingPreferences}
                />
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <ProfileClient user={user} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
