'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Bell, Clock, RefreshCcw } from 'lucide-react';

interface NotificationSettings {
  email_enabled: boolean;
  confirmation_enabled: boolean;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  sender_name: string | null;
  reply_to_email: string | null;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  email_enabled: true,
  confirmation_enabled: true,
  reminder_enabled: true,
  reminder_hours_before: 24,
  sender_name: null,
  reply_to_email: null,
};

const HOURS_OPTIONS = [1, 2, 4, 12, 24, 48];

function shallowEqual(a: NotificationSettings, b: NotificationSettings): boolean {
  return (
    a.email_enabled === b.email_enabled &&
    a.confirmation_enabled === b.confirmation_enabled &&
    a.reminder_enabled === b.reminder_enabled &&
    a.reminder_hours_before === b.reminder_hours_before &&
    a.sender_name === b.sender_name &&
    a.reply_to_email === b.reply_to_email
  );
}

export function NotificationsClient() {
  const t = useTranslations('settings.notifications');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [state, setState] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [initialState, setInitialState] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(() => !shallowEqual(state, initialState), [state, initialState]);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/settings/notifications');
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const json = await response.json();
        const settings = json.data as NotificationSettings;

        if (!mounted) return;

        const normalized: NotificationSettings = {
          email_enabled: settings?.email_enabled ?? true,
          confirmation_enabled: settings?.confirmation_enabled ?? true,
          reminder_enabled: settings?.reminder_enabled ?? true,
          reminder_hours_before: settings?.reminder_hours_before ?? 24,
          sender_name: settings?.sender_name ?? null,
          reply_to_email: settings?.reply_to_email ?? null,
        };

        setState(normalized);
        setInitialState(normalized);
      } catch (error) {
        console.error('[NotificationsClient] Failed to load settings', error);
        toast({
          title: t('save_error'),
          variant: 'destructive',
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, [t, toast]);

  const handleChange = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to save settings');
      }

      setInitialState(state);
      toast({
        title: t('saved_success'),
      });
    } catch (error) {
      console.error('[NotificationsClient] Failed to save settings', error);
      toast({
        title: t('save_error'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setState(initialState);
  };

  return (
    <div className="relative space-y-6">
      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('email_enabled')}</CardTitle>
              <CardDescription>{t('email_enabled_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled" className="text-sm font-medium">
              {state.email_enabled ? tCommon('enabled') : tCommon('disabled')}
            </Label>
            <Switch
              id="email-enabled"
              checked={state.email_enabled}
              onCheckedChange={(checked) => handleChange('email_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card className={!state.email_enabled ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Bell className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle>{t('confirmation_enabled')}</CardTitle>
              <CardDescription>{t('confirmation_enabled_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t('confirmation_enabled')}</p>
              <p className="text-sm text-muted-foreground">{t('confirmation_enabled_description')}</p>
            </div>
            <Switch
              id="confirmation-enabled"
              checked={state.confirmation_enabled}
              onCheckedChange={(checked) => handleChange('confirmation_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t('reminder_enabled')}</p>
              <p className="text-sm text-muted-foreground">{t('reminder_enabled_description')}</p>
            </div>
            <Switch
              id="reminder-enabled"
              checked={state.reminder_enabled}
              onCheckedChange={(checked) => handleChange('reminder_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reminder Timing */}
      <Card className={!state.email_enabled || !state.reminder_enabled ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle>{t('reminder_hours_before')}</CardTitle>
              <CardDescription>{t('reminder_hours_before_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select
            value={String(state.reminder_hours_before)}
            onValueChange={(value) => handleChange('reminder_hours_before', parseInt(value, 10))}
          >
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {HOURS_OPTIONS.map((hours) => (
                  <SelectItem key={hours} value={String(hours)}>
                    {t(`hours_options.${hours}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Sender Configuration */}
      <Card className={!state.email_enabled ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>{t('sender_name')}</CardTitle>
          <CardDescription>{t('sender_name_description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sender-name">{t('sender_name')}</Label>
            <Input
              id="sender-name"
              value={state.sender_name || ''}
              onChange={(e) => handleChange('sender_name', e.target.value || null)}
              placeholder={t('sender_name_placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reply-to">{t('reply_to_email')}</Label>
            <Input
              id="reply-to"
              type="email"
              value={state.reply_to_email || ''}
              onChange={(e) => handleChange('reply_to_email', e.target.value || null)}
              placeholder={t('reply_to_email_placeholder')}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={!hasChanges || saving}
            onClick={handleReset}
            className="w-full sm:w-auto"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {tCommon('reset')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="w-full sm:w-auto"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tCommon('save')}
          </Button>
        </CardFooter>
      </Card>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
