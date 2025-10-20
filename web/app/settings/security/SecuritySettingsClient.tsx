'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  ShieldOff,
  RefreshCcw,
  Loader2,
  Smartphone,
  FileWarning,
  LogOut,
  Copy,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MfaStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
  hasPendingSetup: boolean;
  pendingCreatedAt: string | null;
  lastVerifiedAt: string | null;
}

interface SetupPayload {
  secret: string;
  otpauth: string;
  qrCodeDataUrl: string;
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

function formatDate(input: string | null, locale: string): string | null {
  if (!input) return null;
  try {
    const date = new Date(input);
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return input;
  }
}

export function SecuritySettingsClient() {
  const t = useTranslations('settings.security');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [setupSecret, setSetupSecret] = useState<SetupPayload | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const locale = useMemo(() => t.locale, [t]);

  const loadMfaStatus = async () => {
    setMfaLoading(true);
    try {
      const response = await fetch('/api/settings/security/mfa');
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const json = (await response.json()) as { data: MfaStatus };
      setMfaStatus(json.data);
    } catch (error) {
      console.error('[SecuritySettingsClient] loadMfaStatus failed', error);
      toast({
        title: t('mfa.messages.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    void loadMfaStatus();
  }, []);

  const handlePasswordSubmit = async () => {
    const parsed = passwordSchema.safeParse(passwordForm);
    if (!parsed.success) {
      const errorMap: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) {
          errorMap[err.path[0] as string] = t(`password.errors.${err.message}`);
        }
      });
      setPasswordErrors(errorMap);
      return;
    }

    setPasswordErrors({});
    setPasswordLoading(true);
    const supabase = createClient();

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user.email) {
        throw new Error(sessionError?.message || 'Missing session');
      }

      const email = sessionData.session.user.email;
      const verify = await supabase.auth.signInWithPassword({
        email,
        password: passwordForm.currentPassword,
      });

      if (verify.error) {
        throw new Error(t('password.errors.invalidCurrent'));
      }

      const updateResult = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }

      toast({
        title: t('password.messages.success'),
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswords(false);
    } catch (error) {
      console.error('[SecuritySettingsClient] password change failed', error);
      const message =
        error instanceof Error ? error.message : t('password.messages.failed');
      toast({
        title: t('password.messages.failed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const startMfaSetup = async () => {
    setMfaLoading(true);
    try {
      const response = await fetch('/api/settings/security/mfa/setup', {
        method: 'POST',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to start setup');
      }

      const json = (await response.json()) as { data: SetupPayload };
      setSetupSecret(json.data);
      setRecoveryCodes(null);
      setVerificationCode('');
    } catch (error) {
      console.error('[SecuritySettingsClient] startMfaSetup failed', error);
      toast({
        title: t('mfa.messages.setupFailed'),
        variant: 'destructive',
      });
    } finally {
      setMfaLoading(false);
    }
  };

  const confirmMfa = async () => {
    if (!verificationCode) {
      toast({
        title: t('mfa.messages.codeRequired'),
        variant: 'destructive',
      });
      return;
    }

    setMfaLoading(true);
    try {
      const response = await fetch('/api/settings/security/mfa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to confirm');
      }

      const codes = (payload?.data?.recoveryCodes as string[]) ?? [];
      setRecoveryCodes(codes);
      setVerificationCode('');
      setSetupSecret(null);

      toast({
        title: t('mfa.messages.enabled'),
      });

      await loadMfaStatus();
    } catch (error) {
      console.error('[SecuritySettingsClient] confirmMfa failed', error);
      toast({
        title: t('mfa.messages.confirmFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    setMfaLoading(true);
    try {
      const response = await fetch('/api/settings/security/mfa', { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to disable MFA');
      }

      toast({
        title: t('mfa.messages.disabled'),
      });
      setRecoveryCodes(null);
      setSetupSecret(null);
      setVerificationCode('');
      await loadMfaStatus();
    } catch (error) {
      console.error('[SecuritySettingsClient] disableMfa failed', error);
      toast({
        title: t('mfa.messages.disableFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setMfaLoading(false);
    }
  };

  const regenerateRecoveryCodes = async () => {
    if (!regenerateCode) {
      toast({
        title: t('mfa.messages.codeRequired'),
        variant: 'destructive',
      });
      return;
    }

    setMfaLoading(true);
    try {
      const response = await fetch('/api/settings/security/mfa/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: regenerateCode }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to regenerate codes');
      }

      const codes = (payload?.data?.recoveryCodes as string[]) ?? [];
      setRecoveryCodes(codes);
      setRegenerateCode('');

      toast({
        title: t('mfa.messages.recoveryRegenerated'),
      });
      await loadMfaStatus();
    } catch (error) {
      console.error('[SecuritySettingsClient] regenerateRecoveryCodes failed', error);
      toast({
        title: t('mfa.messages.recoveryFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setMfaLoading(false);
    }
  };

  const downloadRecoveryCodes = () => {
    if (!recoveryCodes?.length) return;
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laralis-recovery-codes-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyRecoveryCodes = () => {
    if (!recoveryCodes?.length || !navigator.clipboard) {
      toast({
        title: t('mfa.messages.copyNotSupported'),
        variant: 'destructive',
      });
      return;
    }
    void navigator.clipboard
      .writeText(recoveryCodes.join('\n'))
      .then(() => toast({ title: t('mfa.messages.copied') }))
      .catch(() =>
        toast({
          title: t('mfa.messages.copyFailed'),
          variant: 'destructive',
        }),
      );
  };

  const signOutOtherDevices = async () => {
    setSignOutLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' as any });
      if (error) throw error;
      toast({
        title: t('sessions.messages.signedOutOthers'),
      });
    } catch (error) {
      console.error('[SecuritySettingsClient] signOutOthers failed', error);
      toast({
        title: t('sessions.messages.signOutFailed'),
        variant: 'destructive',
      });
    } finally {
      setSignOutLoading(false);
    }
  };

  const renderPasswordSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>{t('password.title')}</CardTitle>
        <CardDescription>{t('password.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('password.current')}</Label>
            <Input
              id="currentPassword"
              type={showPasswords ? 'text' : 'password'}
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
              autoComplete="current-password"
            />
            {passwordErrors.currentPassword && (
              <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('password.new')}</Label>
            <Input
              id="newPassword"
              type={showPasswords ? 'text' : 'password'}
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
              autoComplete="new-password"
            />
            {passwordErrors.newPassword && (
              <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('password.confirm')}</Label>
            <Input
              id="confirmPassword"
              type={showPasswords ? 'text' : 'password'}
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
              }
              autoComplete="new-password"
            />
            {passwordErrors.confirmPassword && (
              <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-8">
            <Checkbox
              id="toggle-password"
              checked={showPasswords}
              onCheckedChange={(checked) => setShowPasswords(Boolean(checked))}
            />
            <Label
              htmlFor="toggle-password"
              className="flex cursor-pointer items-center gap-2 text-sm font-normal"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {t('password.show')}
            </Label>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handlePasswordSubmit} disabled={passwordLoading}>
          {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tCommon('save')}
        </Button>
      </CardFooter>
    </Card>
  );

  const renderMfaSection = () => {
    const isEnabled = mfaStatus?.enabled;
    const pending = setupSecret || mfaStatus?.hasPendingSetup;

    return (
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>{t('mfa.title')}</CardTitle>
            <CardDescription>{t('mfa.subtitle')}</CardDescription>
          </div>
          <Badge
            variant={isEnabled ? 'default' : 'secondary'}
            className={isEnabled ? 'bg-emerald-500' : ''}
          >
            {isEnabled ? t('mfa.status.enabled') : t('mfa.status.disabled')}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          {isEnabled && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>{t('mfa.enabled.title')}</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>{t('mfa.enabled.description')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('mfa.enabled.lastVerified', {
                    date: formatDate(mfaStatus?.lastVerifiedAt ?? null, locale) ?? t('mfa.unknown'),
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('mfa.enabled.codesRemaining', {
                    count: mfaStatus?.recoveryCodesLeft ?? 0,
                  })}
                </p>
              </AlertDescription>
            </Alert>
          )}

          {!isEnabled && !pending && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Smartphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{t('mfa.callout.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('mfa.callout.description')}</p>
              <div className="mt-4 flex justify-center">
                <Button onClick={startMfaSetup} disabled={mfaLoading}>
                  {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('mfa.actions.enable')}
                </Button>
              </div>
            </div>
          )}

          {pending && setupSecret && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-semibold">{t('mfa.setup.scanTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('mfa.setup.scanDescription')}</p>
                <div className="flex items-center justify-center rounded-lg border bg-background p-4">
                  <Image
                    src={setupSecret.qrCodeDataUrl}
                    alt="QR Code"
                    width={220}
                    height={220}
                  />
                </div>
                <Alert>
                  <FileWarning className="h-4 w-4" />
                  <AlertDescription>{t('mfa.setup.secretHint', { secret: setupSecret.secret })}</AlertDescription>
                </Alert>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">{t('mfa.setup.verifyTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('mfa.setup.verifyDescription')}</p>
                <Input
                  inputMode="numeric"
                  maxLength={10}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="123456"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-device"
                    checked={rememberDevice}
                    onCheckedChange={(checked) => setRememberDevice(Boolean(checked))}
                  />
                  <Label
                    htmlFor="remember-device"
                    className="text-sm font-normal text-muted-foreground"
                  >
                    {t('mfa.setup.rememberDevice')}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={confirmMfa} disabled={mfaLoading}>
                    {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('mfa.actions.confirm')}
                  </Button>
                  <Button variant="outline" onClick={disableMfa} disabled={mfaLoading}>
                    <ShieldOff className="mr-2 h-4 w-4" />
                    {t('mfa.actions.cancel')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isEnabled && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="outline" onClick={startMfaSetup} disabled={mfaLoading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {t('mfa.actions.reconfigure')}
                </Button>
                <Button variant="destructive" onClick={disableMfa} disabled={mfaLoading}>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  {t('mfa.actions.disable')}
                </Button>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">{t('mfa.recovery.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('mfa.recovery.description')}</p>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="regenerateCode" className="text-sm">
                      {t('mfa.recovery.codeLabel')}
                    </Label>
                    <Input
                      id="regenerateCode"
                      inputMode="numeric"
                      maxLength={10}
                      value={regenerateCode}
                      onChange={(event) => setRegenerateCode(event.target.value)}
                      className="max-w-xs"
                      placeholder="123456"
                    />
                    <Button onClick={regenerateRecoveryCodes} disabled={mfaLoading}>
                      {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('mfa.actions.regenerate')}
                    </Button>
                  </div>

                  {!!recoveryCodes?.length && (
                    <div className="rounded-md border bg-muted/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-medium">{t('mfa.recovery.codesTitle')}</h4>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={copyRecoveryCodes}>
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            {t('mfa.actions.copy')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={downloadRecoveryCodes}>
                            <Download className="mr-2 h-3.5 w-3.5" />
                            {t('mfa.actions.download')}
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {recoveryCodes.map((code) => (
                          <code
                            key={code}
                            className="rounded bg-background px-3 py-2 text-sm font-semibold tracking-[0.3em]"
                          >
                            {code}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSessionsSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>{t('sessions.title')}</CardTitle>
        <CardDescription>{t('sessions.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="warning">
          <LogOut className="h-4 w-4" />
          <AlertTitle>{t('sessions.notice.title')}</AlertTitle>
          <AlertDescription>{t('sessions.notice.description')}</AlertDescription>
        </Alert>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('sessions.description')}</p>
          <Button
            onClick={signOutOtherDevices}
            variant="outline"
            disabled={signOutLoading}
          >
            {signOutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('sessions.actions.signOutOthers')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {renderPasswordSection()}
      {renderMfaSection()}
      {renderSessionsSection()}
    </div>
  );
}
