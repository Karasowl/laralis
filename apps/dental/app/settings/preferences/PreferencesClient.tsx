'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCcw } from 'lucide-react';

type ThemeOption = 'light' | 'dark' | 'system';
type LocaleOption = 'es' | 'en';

interface PreferencesState {
  locale: LocaleOption;
  timezone: string;
  theme: ThemeOption;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
}

const DEFAULT_STATE: PreferencesState = {
  locale: 'es',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  theme: 'system',
  notifications: {
    email: true,
    sms: false,
    push: false,
  },
};

function getTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone');
  }

  // Fallback minimal list
  return [
    'UTC',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Sao_Paulo',
    'Europe/Madrid',
  ];
}

function shallowEqualPreferences(a: PreferencesState, b: PreferencesState): boolean {
  return (
    a.locale === b.locale &&
    a.timezone === b.timezone &&
    a.theme === b.theme &&
    a.notifications.email === b.notifications.email &&
    a.notifications.sms === b.notifications.sms &&
    a.notifications.push === b.notifications.push
  );
}

export function PreferencesClient() {
  const t = useTranslations('settings.preferences');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { setTheme: setNextTheme } = useTheme();

  const [state, setState] = useState<PreferencesState>(DEFAULT_STATE);
  const [initialState, setInitialState] = useState<PreferencesState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(() => !shallowEqualPreferences(state, initialState), [state, initialState]);

  useEffect(() => {
    let mounted = true;

    const loadPreferences = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/settings/preferences');
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const json = await response.json();
        const payload = json.data as PreferencesState;
        if (!payload) {
          throw new Error('Invalid response');
        }

        if (!mounted) return;

        const normalized: PreferencesState = {
          locale: (payload.locale === 'en' ? 'en' : 'es') as LocaleOption,
          timezone: payload.timezone || DEFAULT_STATE.timezone,
          theme: (['light', 'dark', 'system'].includes(payload.theme) ? payload.theme : 'system') as ThemeOption,
          notifications: {
            email: Boolean(payload.notifications?.email),
            sms: Boolean(payload.notifications?.sms),
            push: Boolean(payload.notifications?.push),
          },
        };

        setState(normalized);
        setInitialState(normalized);
        setNextTheme(normalized.theme);
      } catch (error) {
        console.error('[PreferencesClient] Failed to load preferences', error);
        toast({
          title: t('messages.loadFailed'),
          variant: 'destructive',
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      mounted = false;
    };
  }, [setNextTheme, t, toast]);

  const timezoneOptions = useMemo(() => getTimezones(), []);

  const handleChange = (callback: (prev: PreferencesState) => PreferencesState) => {
    setState(callback);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to update preferences');
      }

      setInitialState(state);
      setNextTheme(state.theme);

      if (typeof document !== 'undefined') {
        document.cookie = `locale=${state.locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
      }

      toast({
        title: t('messages.saveSuccess'),
      });
    } catch (error) {
      console.error('[PreferencesClient] Failed to save preferences', error);
      toast({
        title: t('messages.saveFailed'),
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
      <Card>
        <CardHeader>
          <CardTitle>{t('language.title')}</CardTitle>
          <CardDescription>{t('language.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="locale">{t('language.label')}</Label>
            <Select
              value={state.locale}
              onValueChange={(value: LocaleOption) => {
                handleChange((prev) => ({ ...prev, locale: value }));
              }}
            >
              <SelectTrigger id="locale">
                <SelectValue placeholder={t('language.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="es">{t('language.options.es')}</SelectItem>
                  <SelectItem value="en">{t('language.options.en')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t('timezone.label')}</Label>
            <Select
              value={state.timezone}
              onValueChange={(value: string) => {
                handleChange((prev) => ({ ...prev, timezone: value }));
              }}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder={t('timezone.placeholder')} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectGroup>
                  {timezoneOptions.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('appearance.title')}</CardTitle>
          <CardDescription>{t('appearance.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {(['light', 'dark', 'system'] as ThemeOption[]).map((themeOption) => (
            <button
              key={themeOption}
              type="button"
              className={`rounded-lg border p-4 text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                state.theme === themeOption
                  ? 'border-primary shadow-md'
                  : 'border-border hover:bg-muted/50'
              }`}
              onClick={() => {
                setNextTheme(themeOption);
                handleChange((prev) => ({ ...prev, theme: themeOption }));
              }}
            >
              <div className="font-semibold capitalize">{t(`appearance.options.${themeOption}`)}</div>
              <p className="text-sm text-muted-foreground">{t(`appearance.descriptions.${themeOption}`)}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.title')}</CardTitle>
          <CardDescription>{t('notifications.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">{t('notifications.channels.email.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('notifications.channels.email.description')}
              </p>
            </div>
            <Checkbox
              id="notif-email"
              checked={state.notifications.email}
              onCheckedChange={(checked) =>
                handleChange((prev) => ({
                  ...prev,
                  notifications: { ...prev.notifications, email: Boolean(checked) },
                }))
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">{t('notifications.channels.sms.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('notifications.channels.sms.description')}
              </p>
            </div>
            <Checkbox
              id="notif-sms"
              checked={state.notifications.sms}
              onCheckedChange={(checked) =>
                handleChange((prev) => ({
                  ...prev,
                  notifications: { ...prev.notifications, sms: Boolean(checked) },
                }))
              }
            />
          </div>

  <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-medium">{t('notifications.channels.push.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('notifications.channels.push.description')}
              </p>
            </div>
            <Checkbox
              id="notif-push"
              checked={state.notifications.push}
              onCheckedChange={(checked) =>
                handleChange((prev) => ({
                  ...prev,
                  notifications: { ...prev.notifications, push: Boolean(checked) },
                }))
              }
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
            {t('actions.reset')}
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
