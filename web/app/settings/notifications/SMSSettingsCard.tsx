'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { MessageSquare, User, Building2, Phone, Bell, Clock } from 'lucide-react'
import { type SMSConfig, DEFAULT_SMS_CONFIG } from '@/lib/sms/types'

export type { SMSConfig }

interface SMSSettingsCardProps {
  settings: SMSConfig
  onChange: (settings: SMSConfig) => void
}

export function SMSSettingsCard({ settings, onChange }: SMSSettingsCardProps) {
  const t = useTranslations('settings.notifications.sms')

  // Helper to update nested patient settings
  const updatePatient = (key: keyof SMSConfig['patient'], value: boolean) => {
    onChange({
      ...settings,
      patient: { ...settings.patient, [key]: value },
    })
  }

  // Helper to update nested staff settings
  const updateStaff = <K extends keyof SMSConfig['staff']>(
    key: K,
    value: SMSConfig['staff'][K]
  ) => {
    onChange({
      ...settings,
      staff: { ...settings.staff, [key]: value },
    })
  }

  const isEnabled = settings.enabled

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-500/10 p-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center justify-between">
              {t('title')}
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => onChange({ ...settings, enabled: checked })}
              />
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className={!isEnabled ? 'opacity-50 pointer-events-none' : ''}>
        <div className="space-y-6">
          {/* Country Code */}
          <div className="space-y-2">
            <Label htmlFor="sms-country-code">{t('country_code')}</Label>
            <Input
              id="sms-country-code"
              value={settings.default_country_code}
              onChange={(e) => onChange({ ...settings, default_country_code: e.target.value })}
              placeholder="52"
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">{t('country_code_help')}</p>
          </div>

          {/* Patient Notifications Section */}
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-blue-500" />
              {t('patient_section')}
            </div>
            <p className="text-xs text-muted-foreground">{t('patient_section_description')}</p>

            <div className="grid gap-3">
              <NotificationToggle
                label={t('on_treatment_created')}
                description={t('on_treatment_created_desc')}
                checked={settings.patient.on_treatment_created}
                onCheckedChange={(checked) => updatePatient('on_treatment_created', checked)}
                icon={<Bell className="h-4 w-4" />}
              />
              <NotificationToggle
                label={t('on_treatment_updated')}
                description={t('on_treatment_updated_desc')}
                checked={settings.patient.on_treatment_updated}
                onCheckedChange={(checked) => updatePatient('on_treatment_updated', checked)}
                icon={<Bell className="h-4 w-4" />}
              />
              <NotificationToggle
                label={t('reminder_24h')}
                description={t('reminder_24h_desc')}
                checked={settings.patient.reminder_24h}
                onCheckedChange={(checked) => updatePatient('reminder_24h', checked)}
                icon={<Clock className="h-4 w-4" />}
              />
              <NotificationToggle
                label={t('reminder_2h')}
                description={t('reminder_2h_desc')}
                checked={settings.patient.reminder_2h}
                onCheckedChange={(checked) => updatePatient('reminder_2h', checked)}
                icon={<Clock className="h-4 w-4" />}
              />
            </div>
          </div>

          {/* Staff Notifications Section */}
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-purple-500" />
                {t('staff_section')}
              </div>
              <Switch
                checked={settings.staff.enabled}
                onCheckedChange={(checked) => updateStaff('enabled', checked)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('staff_section_description')}</p>

            <div className={!settings.staff.enabled ? 'opacity-50 pointer-events-none' : ''}>
              {/* Staff Phone Numbers */}
              <div className="grid gap-4 sm:grid-cols-2 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="sms-staff-phone" className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    {t('staff_phone')}
                  </Label>
                  <Input
                    id="sms-staff-phone"
                    type="tel"
                    value={settings.staff.phone}
                    onChange={(e) => updateStaff('phone', e.target.value)}
                    placeholder="+521234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-extra-phone" className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    {t('extra_phone')}
                  </Label>
                  <Input
                    id="sms-extra-phone"
                    type="tel"
                    value={settings.staff.extra_phone}
                    onChange={(e) => updateStaff('extra_phone', e.target.value)}
                    placeholder="+521234567890"
                  />
                  <p className="text-xs text-muted-foreground">{t('extra_phone_help')}</p>
                </div>
              </div>

              {/* Staff Notification Types */}
              <div className="grid gap-3">
                <NotificationToggle
                  label={t('staff_on_treatment_created')}
                  description={t('staff_on_treatment_created_desc')}
                  checked={settings.staff.on_treatment_created}
                  onCheckedChange={(checked) => updateStaff('on_treatment_created', checked)}
                  icon={<Bell className="h-4 w-4" />}
                />
                <NotificationToggle
                  label={t('staff_on_treatment_updated')}
                  description={t('staff_on_treatment_updated_desc')}
                  checked={settings.staff.on_treatment_updated}
                  onCheckedChange={(checked) => updateStaff('on_treatment_updated', checked)}
                  icon={<Bell className="h-4 w-4" />}
                />
                <NotificationToggle
                  label={t('staff_reminder_24h')}
                  description={t('staff_reminder_24h_desc')}
                  checked={settings.staff.reminder_24h}
                  onCheckedChange={(checked) => updateStaff('reminder_24h', checked)}
                  icon={<Clock className="h-4 w-4" />}
                />
                <NotificationToggle
                  label={t('staff_reminder_2h')}
                  description={t('staff_reminder_2h_desc')}
                  checked={settings.staff.reminder_2h}
                  onCheckedChange={(checked) => updateStaff('reminder_2h', checked)}
                  icon={<Clock className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Helper component for notification toggles
interface NotificationToggleProps {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  icon: React.ReactNode
}

function NotificationToggle({
  label,
  description,
  checked,
  onCheckedChange,
  icon,
}: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/30">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export { DEFAULT_SMS_CONFIG }
