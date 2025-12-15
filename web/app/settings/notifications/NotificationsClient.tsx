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
import { Loader2, Mail, Bell, Clock, RefreshCcw, BellRing } from 'lucide-react';
import { WhatsAppSettingsCard, type WhatsAppSettings } from './WhatsAppSettingsCard';
import { SMSSettingsCard, type SMSConfig, DEFAULT_SMS_CONFIG } from './SMSSettingsCard';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface NotificationSettings {
  email_enabled: boolean;
  confirmation_enabled: boolean;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  sender_name: string | null;
  reply_to_email: string | null;
  whatsapp?: WhatsAppSettings;
  sms?: SMSConfig;
}

const DEFAULT_WHATSAPP: WhatsAppSettings = {
  enabled: false,
  provider: 'twilio',
  twilio_account_sid: '',
  twilio_auth_token: '',
  twilio_phone_number: '',
  dialog360_api_key: '',
  default_country_code: '52',
  send_confirmations: true,
  send_reminders: true,
  reminder_hours_before: 24,
};

const DEFAULT_SETTINGS: NotificationSettings = {
  email_enabled: true,
  confirmation_enabled: true,
  reminder_enabled: true,
  reminder_hours_before: 24,
  sender_name: null,
  reply_to_email: null,
  whatsapp: DEFAULT_WHATSAPP,
  sms: DEFAULT_SMS_CONFIG,
};

const HOURS_OPTIONS = [1, 2, 4, 12, 24, 48];

function shallowEqual(a: NotificationSettings, b: NotificationSettings): boolean {
  const baseEqual =
    a.email_enabled === b.email_enabled &&
    a.confirmation_enabled === b.confirmation_enabled &&
    a.reminder_enabled === b.reminder_enabled &&
    a.reminder_hours_before === b.reminder_hours_before &&
    a.sender_name === b.sender_name &&
    a.reply_to_email === b.reply_to_email;

  if (!baseEqual) return false;

  // Compare WhatsApp settings
  const wa = a.whatsapp || DEFAULT_WHATSAPP;
  const wb = b.whatsapp || DEFAULT_WHATSAPP;

  const waEqual =
    wa.enabled === wb.enabled &&
    wa.provider === wb.provider &&
    wa.twilio_account_sid === wb.twilio_account_sid &&
    wa.twilio_auth_token === wb.twilio_auth_token &&
    wa.twilio_phone_number === wb.twilio_phone_number &&
    wa.dialog360_api_key === wb.dialog360_api_key &&
    wa.default_country_code === wb.default_country_code &&
    wa.send_confirmations === wb.send_confirmations &&
    wa.send_reminders === wb.send_reminders;

  if (!waEqual) return false;

  // Compare SMS settings
  const sa = a.sms || DEFAULT_SMS_CONFIG;
  const sb = b.sms || DEFAULT_SMS_CONFIG;

  return (
    sa.enabled === sb.enabled &&
    sa.default_country_code === sb.default_country_code &&
    sa.patient.on_treatment_created === sb.patient.on_treatment_created &&
    sa.patient.on_treatment_updated === sb.patient.on_treatment_updated &&
    sa.patient.reminder_24h === sb.patient.reminder_24h &&
    sa.patient.reminder_2h === sb.patient.reminder_2h &&
    sa.staff.enabled === sb.staff.enabled &&
    sa.staff.phone === sb.staff.phone &&
    sa.staff.extra_phone === sb.staff.extra_phone &&
    sa.staff.on_treatment_created === sb.staff.on_treatment_created &&
    sa.staff.on_treatment_updated === sb.staff.on_treatment_updated &&
    sa.staff.reminder_24h === sb.staff.reminder_24h &&
    sa.staff.reminder_2h === sb.staff.reminder_2h
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

  // Push notifications hook
  const {
    isSupported: pushSupported,
    isPermissionGranted: pushPermissionGranted,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    error: pushError,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications();

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
          whatsapp: {
            ...DEFAULT_WHATSAPP,
            ...(settings?.whatsapp || {}),
          },
          sms: {
            ...DEFAULT_SMS_CONFIG,
            ...(settings?.sms || {}),
            patient: {
              ...DEFAULT_SMS_CONFIG.patient,
              ...(settings?.sms?.patient || {}),
            },
            staff: {
              ...DEFAULT_SMS_CONFIG.staff,
              ...(settings?.sms?.staff || {}),
            },
          },
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
      </Card>

      {/* WhatsApp Configuration */}
      <WhatsAppSettingsCard
        settings={state.whatsapp || DEFAULT_WHATSAPP}
        onChange={(whatsapp) => setState((prev) => ({ ...prev, whatsapp }))}
      />

      {/* SMS Configuration */}
      <SMSSettingsCard
        settings={state.sms || DEFAULT_SMS_CONFIG}
        onChange={(sms) => setState((prev) => ({ ...prev, sms }))}
      />

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <BellRing className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>{t('push_notifications')}</CardTitle>
              <CardDescription>{t('push_notifications_description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushSupported && (
            <div className="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              {t('push_not_supported')}
            </div>
          )}

          {pushSupported && !pushPermissionGranted && !pushSubscribed && (
            <div className="rounded-lg border p-4">
              <p className="mb-4 text-sm text-muted-foreground">
                {t('push_permission_description')}
              </p>
              <Button
                onClick={async () => {
                  const success = await pushSubscribe();
                  if (success) {
                    toast({
                      title: t('push_enabled_success'),
                    });
                  } else if (pushError) {
                    toast({
                      title: t('push_enable_error'),
                      description: pushError,
                      variant: 'destructive',
                    });
                  }
                }}
                disabled={pushLoading}
                className="w-full sm:w-auto"
              >
                {pushLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('enable_push_notifications')}
              </Button>
            </div>
          )}

          {pushSupported && pushSubscribed && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    {t('push_enabled')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('push_enabled_description')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const success = await pushUnsubscribe();
                    if (success) {
                      toast({
                        title: t('push_disabled_success'),
                      });
                    } else if (pushError) {
                      toast({
                        title: t('push_disable_error'),
                        description: pushError,
                        variant: 'destructive',
                      });
                    }
                  }}
                  disabled={pushLoading}
                >
                  {pushLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('disable_push_notifications')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Actions */}
      <Card>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-6">
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
