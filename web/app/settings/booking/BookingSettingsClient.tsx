'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Copy, ExternalLink, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TimeRange {
  start: string;
  end: string;
}

interface BookingConfig {
  enabled: boolean;
  allow_new_patients: boolean;
  require_phone: boolean;
  require_notes: boolean;
  max_advance_days: number;
  min_advance_hours: number;
  slot_duration_minutes: number;
  working_hours: Record<string, TimeRange | null>;
  buffer_minutes: number;
  welcome_message: string | null;
  confirmation_message: string | null;
}

interface BookingService {
  id: string;
  name: string;
  description?: string | null;
  est_minutes?: number | null;
  is_active?: boolean;
}

interface BookingSettingsResponse {
  clinic: {
    id: string;
    name: string;
    slug: string | null;
  };
  booking_config: BookingConfig;
  selected_service_ids: string[];
  services: BookingService[];
}

const DAYS: Array<{ key: string; shortKey: string }> = [
  { key: 'monday', shortKey: 'monday' },
  { key: 'tuesday', shortKey: 'tuesday' },
  { key: 'wednesday', shortKey: 'wednesday' },
  { key: 'thursday', shortKey: 'thursday' },
  { key: 'friday', shortKey: 'friday' },
  { key: 'saturday', shortKey: 'saturday' },
  { key: 'sunday', shortKey: 'sunday' },
];

export function BookingSettingsClient() {
  const t = useTranslations('settings.booking');
  const tCommon = useTranslations('common');
  const tDays = useTranslations('time.workingDays');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  const [clinicName, setClinicName] = useState('');
  const [slug, setSlug] = useState('');
  const [bookingConfig, setBookingConfig] = useState<BookingConfig | null>(null);
  const [services, setServices] = useState<BookingService[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [useAllServices, setUseAllServices] = useState(true);
  const [initialSnapshot, setInitialSnapshot] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const snapshot = (config: BookingConfig | null, slugValue: string, selection: string[]) => {
    if (!config) return '';
    const sorted = [...selection].sort();
    return JSON.stringify({
      slug: slugValue || null,
      booking_config: config,
      selected_service_ids: sorted,
    });
  };

  const hasChanges = useMemo(() => {
    if (!bookingConfig) return false;
    return snapshot(bookingConfig, slug, selectedServiceIds) !== initialSnapshot;
  }, [bookingConfig, slug, selectedServiceIds, initialSnapshot]);

  const bookingUrl = useMemo(() => {
    if (!slug || !baseUrl) return '';
    return `${baseUrl}/book/${slug}`;
  }, [slug, baseUrl]);

  const servicesValid = useAllServices || selectedServiceIds.length > 0;

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/settings/booking');
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const payload = await response.json();
        const data = payload.data as BookingSettingsResponse;

        if (!mounted) return;

        setClinicName(data.clinic?.name || '');
        setSlug(data.clinic?.slug || '');
        setBookingConfig(data.booking_config);
        setServices(data.services || []);
        setSelectedServiceIds(data.selected_service_ids || []);
        setUseAllServices((data.selected_service_ids || []).length === 0);

        const nextSnapshot = snapshot(data.booking_config, data.clinic?.slug || '', data.selected_service_ids || []);
        setInitialSnapshot(nextSnapshot);
      } catch (error) {
        console.error('[BookingSettingsClient] Failed to load settings', error);
        toast({ title: t('load_error'), variant: 'destructive' });
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

  const updateConfig = (partial: Partial<BookingConfig>) => {
    if (!bookingConfig) return;
    setBookingConfig({
      ...bookingConfig,
      ...partial,
    });
  };

  const updateWorkingDay = (day: string, value: TimeRange | null) => {
    if (!bookingConfig) return;
    setBookingConfig({
      ...bookingConfig,
      working_hours: {
        ...bookingConfig.working_hours,
        [day]: value,
      },
    });
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    setSelectedServiceIds((prev) => {
      if (checked) {
        return prev.includes(serviceId) ? prev : [...prev, serviceId];
      }
      return prev.filter((id) => id !== serviceId);
    });
  };

  const handleSave = async () => {
    if (!bookingConfig || !servicesValid) {
      toast({ title: t('services_error'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/settings/booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug || null,
          booking_config: bookingConfig,
          service_ids: useAllServices ? [] : selectedServiceIds,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to save booking settings');
      }

      toast({ title: t('save_success') });
      const reload = await fetch('/api/settings/booking');
      if (reload.ok) {
        const payload = await reload.json();
        const data = payload.data as BookingSettingsResponse;
        setClinicName(data.clinic?.name || '');
        setSlug(data.clinic?.slug || '');
        setBookingConfig(data.booking_config);
        setServices(data.services || []);
        setSelectedServiceIds(data.selected_service_ids || []);
        setUseAllServices((data.selected_service_ids || []).length === 0);
        setInitialSnapshot(snapshot(data.booking_config, data.clinic?.slug || '', data.selected_service_ids || []));
      }
    } catch (error) {
      console.error('[BookingSettingsClient] Failed to save settings', error);
      toast({ title: t('save_error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!bookingConfig) return;
    if (!initialSnapshot) return;
    const parsed = JSON.parse(initialSnapshot) as {
      slug: string | null;
      booking_config: BookingConfig;
      selected_service_ids: string[];
    };
    setSlug(parsed.slug || '');
    setBookingConfig(parsed.booking_config);
    setSelectedServiceIds(parsed.selected_service_ids || []);
    setUseAllServices((parsed.selected_service_ids || []).length === 0);
  };

  const handleCopyLink = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({ title: t('link_copied') });
    } catch (error) {
      console.error('[BookingSettingsClient] Failed to copy link', error);
    }
  };

  if (!bookingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('enable_title')}</CardTitle>
          <CardDescription>{t('enable_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t('enable_switch')}</p>
              <p className="text-sm text-muted-foreground">{clinicName}</p>
            </div>
            <Switch
              checked={bookingConfig.enabled}
              onCheckedChange={(checked) => updateConfig({ enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-slug">{t('slug_label')}</Label>
            <Input
              id="booking-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('slug_placeholder')}
            />
            <p className="text-xs text-muted-foreground">{t('slug_help')}</p>
          </div>

          {bookingUrl ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{t('public_link')}</p>
                  <p className="text-xs text-muted-foreground">{bookingUrl}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t('copy_link')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={bookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t('open_link')}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t('link_pending')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={!bookingConfig.enabled ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>{t('rules_title')}</CardTitle>
          <CardDescription>{t('rules_description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="min-advance">{t('min_advance_hours')}</Label>
            <Input
              id="min-advance"
              type="number"
              min={0}
              value={bookingConfig.min_advance_hours}
              onChange={(e) => updateConfig({ min_advance_hours: Number(e.target.value || 0) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-advance">{t('max_advance_days')}</Label>
            <Input
              id="max-advance"
              type="number"
              min={1}
              value={bookingConfig.max_advance_days}
              onChange={(e) => updateConfig({ max_advance_days: Number(e.target.value || 0) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-duration">{t('slot_duration')}</Label>
            <Input
              id="slot-duration"
              type="number"
              min={5}
              value={bookingConfig.slot_duration_minutes}
              onChange={(e) => updateConfig({ slot_duration_minutes: Number(e.target.value || 0) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buffer-minutes">{t('buffer_minutes')}</Label>
            <Input
              id="buffer-minutes"
              type="number"
              min={0}
              value={bookingConfig.buffer_minutes}
              onChange={(e) => updateConfig({ buffer_minutes: Number(e.target.value || 0) })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t('require_phone')}</p>
              <p className="text-xs text-muted-foreground">{t('require_phone_desc')}</p>
            </div>
            <Switch
              checked={bookingConfig.require_phone}
              onCheckedChange={(checked) => updateConfig({ require_phone: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t('require_notes')}</p>
              <p className="text-xs text-muted-foreground">{t('require_notes_desc')}</p>
            </div>
            <Switch
              checked={bookingConfig.require_notes}
              onCheckedChange={(checked) => updateConfig({ require_notes: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={!bookingConfig.enabled ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>{t('hours_title')}</CardTitle>
          <CardDescription>{t('hours_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => {
            const dayConfig = bookingConfig.working_hours?.[day.key] || null;
            const isOpen = Boolean(dayConfig);
            return (
              <div key={day.key} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isOpen}
                    onCheckedChange={(checked) =>
                      updateWorkingDay(
                        day.key,
                        checked ? dayConfig || { start: '09:00', end: '18:00' } : null
                      )
                    }
                  />
                  <span className="text-sm font-medium">
                    {tDays(`days.${day.shortKey}.full`)}
                  </span>
                </div>
                {isOpen && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayConfig?.start || '09:00'}
                      onChange={(e) =>
                        updateWorkingDay(day.key, {
                          start: e.target.value,
                          end: dayConfig?.end || '18:00',
                        })
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="time"
                      value={dayConfig?.end || '18:00'}
                      onChange={(e) =>
                        updateWorkingDay(day.key, {
                          start: dayConfig?.start || '09:00',
                          end: e.target.value,
                        })
                      }
                      className="w-28"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className={!bookingConfig.enabled ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>{t('services_title')}</CardTitle>
          <CardDescription>{t('services_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t('services_all')}</p>
              <p className="text-xs text-muted-foreground">{t('services_all_desc')}</p>
            </div>
            <Switch
              checked={useAllServices}
              onCheckedChange={(checked) => {
                setUseAllServices(checked);
                if (checked) setSelectedServiceIds([]);
              }}
            />
          </div>

          {!useAllServices && (
            <div className="grid gap-3 md:grid-cols-2">
              {(services || []).map((service) => (
                <label
                  key={service.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    checked={selectedServiceIds.includes(service.id)}
                    onCheckedChange={(checked) => handleServiceToggle(service.id, checked === true)}
                  />
                  <div>
                    <p className="text-sm font-medium">{service.name}</p>
                    {service.description && (
                      <p className="text-xs text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {!servicesValid && (
            <p className="text-sm text-destructive">{t('services_error')}</p>
          )}
        </CardContent>
      </Card>

      <Card className={!bookingConfig.enabled ? 'opacity-50 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>{t('messages_title')}</CardTitle>
          <CardDescription>{t('messages_description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="welcome-message">{t('welcome_message')}</Label>
            <Textarea
              id="welcome-message"
              value={bookingConfig.welcome_message || ''}
              onChange={(e) => updateConfig({ welcome_message: e.target.value || null })}
              placeholder={t('welcome_placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation-message">{t('confirmation_message')}</Label>
            <Textarea
              id="confirmation-message"
              value={bookingConfig.confirmation_message || ''}
              onChange={(e) => updateConfig({ confirmation_message: e.target.value || null })}
              placeholder={t('confirmation_placeholder')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-6">
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
            disabled={!hasChanges || saving || !servicesValid}
            className="w-full sm:w-auto"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tCommon('save')}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
