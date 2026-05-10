'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MessageSquare, Eye, EyeOff, ExternalLink } from 'lucide-react'
import type { WhatsAppProvider } from '@/lib/whatsapp/types'

export interface WhatsAppSettings {
  enabled: boolean
  provider: WhatsAppProvider
  twilio_account_sid: string
  twilio_auth_token: string
  twilio_phone_number: string
  dialog360_api_key: string
  default_country_code: string
  send_confirmations: boolean
  send_reminders: boolean
  reminder_hours_before: number
}

interface WhatsAppSettingsCardProps {
  settings: WhatsAppSettings
  onChange: (settings: WhatsAppSettings) => void
  disabled?: boolean
}

export function WhatsAppSettingsCard({
  settings,
  onChange,
  disabled = false,
}: WhatsAppSettingsCardProps) {
  const t = useTranslations('settings.notifications.whatsapp')
  const tCommon = useTranslations('common')

  const [showTokens, setShowTokens] = useState(false)

  const handleChange = <K extends keyof WhatsAppSettings>(
    key: K,
    value: WhatsAppSettings[K]
  ) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <Card className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-500/10 p-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1">
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => handleChange('enabled', checked)}
          />
        </div>
      </CardHeader>

      {settings.enabled && (
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>{t('provider')}</Label>
            <Select
              value={settings.provider}
              onValueChange={(value) => handleChange('provider', value as WhatsAppProvider)}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="360dialog">360dialog</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {settings.provider === 'twilio' ? (
                <a
                  href="https://www.twilio.com/docs/whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {t('twilio_docs')} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <a
                  href="https://docs.360dialog.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {t('dialog360_docs')} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          </div>

          {/* Twilio Config */}
          {settings.provider === 'twilio' && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{t('twilio_config')}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTokens(!showTokens)}
                >
                  {showTokens ? (
                    <EyeOff className="h-4 w-4 mr-1" />
                  ) : (
                    <Eye className="h-4 w-4 mr-1" />
                  )}
                  {showTokens ? tCommon('hide') : tCommon('show')}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="twilio-sid">{t('twilio_account_sid')}</Label>
                  <Input
                    id="twilio-sid"
                    type={showTokens ? 'text' : 'password'}
                    value={settings.twilio_account_sid}
                    onChange={(e) => handleChange('twilio_account_sid', e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twilio-token">{t('twilio_auth_token')}</Label>
                  <Input
                    id="twilio-token"
                    type={showTokens ? 'text' : 'password'}
                    value={settings.twilio_auth_token}
                    onChange={(e) => handleChange('twilio_auth_token', e.target.value)}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="twilio-phone">{t('twilio_phone_number')}</Label>
                  <Input
                    id="twilio-phone"
                    value={settings.twilio_phone_number}
                    onChange={(e) => handleChange('twilio_phone_number', e.target.value)}
                    placeholder="whatsapp:+14155238886"
                  />
                  <p className="text-xs text-muted-foreground">{t('twilio_phone_hint')}</p>
                </div>
              </div>
            </div>
          )}

          {/* 360dialog Config */}
          {settings.provider === '360dialog' && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{t('dialog360_config')}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTokens(!showTokens)}
                >
                  {showTokens ? (
                    <EyeOff className="h-4 w-4 mr-1" />
                  ) : (
                    <Eye className="h-4 w-4 mr-1" />
                  )}
                  {showTokens ? tCommon('hide') : tCommon('show')}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dialog360-key">{t('dialog360_api_key')}</Label>
                <Input
                  id="dialog360-key"
                  type={showTokens ? 'text' : 'password'}
                  value={settings.dialog360_api_key}
                  onChange={(e) => handleChange('dialog360_api_key', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
            </div>
          )}

          {/* General Settings */}
          <div className="space-y-4 rounded-lg border p-4">
            <h4 className="font-medium">{t('general_settings')}</h4>

            <div className="space-y-2">
              <Label htmlFor="country-code">{t('default_country_code')}</Label>
              <Select
                value={settings.default_country_code}
                onValueChange={(value) => handleChange('default_country_code', value)}
              >
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="52">+52 (México)</SelectItem>
                  <SelectItem value="1">+1 (USA/Canadá)</SelectItem>
                  <SelectItem value="34">+34 (España)</SelectItem>
                  <SelectItem value="57">+57 (Colombia)</SelectItem>
                  <SelectItem value="54">+54 (Argentina)</SelectItem>
                  <SelectItem value="56">+56 (Chile)</SelectItem>
                  <SelectItem value="51">+51 (Perú)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div>
                <p className="font-medium text-sm">{t('send_confirmations')}</p>
                <p className="text-xs text-muted-foreground">{t('send_confirmations_desc')}</p>
              </div>
              <Switch
                checked={settings.send_confirmations}
                onCheckedChange={(checked) => handleChange('send_confirmations', checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div>
                <p className="font-medium text-sm">{t('send_reminders')}</p>
                <p className="text-xs text-muted-foreground">{t('send_reminders_desc')}</p>
              </div>
              <Switch
                checked={settings.send_reminders}
                onCheckedChange={(checked) => handleChange('send_reminders', checked)}
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
