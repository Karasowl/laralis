'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ClinicRole, PermissionMap, WorkspaceRole } from '@/lib/permissions/types';

interface SelfAccessPanelProps {
  workspaceRole: WorkspaceRole | null;
  clinicRole: ClinicRole | null;
  permissions: PermissionMap;
  clinicName?: string | null;
}

const KEY_PERMISSIONS = [
  { key: 'patients.view', label: 'selfAccess.permissions.patients' },
  { key: 'treatments.view', label: 'selfAccess.permissions.treatments' },
  { key: 'inbox.view', label: 'selfAccess.permissions.inbox' },
  { key: 'expenses.view', label: 'selfAccess.permissions.expenses' },
  { key: 'settings.view', label: 'selfAccess.permissions.settings' },
  { key: 'team.view', label: 'selfAccess.permissions.team' },
] as const;

export function SelfAccessPanel({
  workspaceRole,
  clinicRole,
  permissions,
  clinicName,
}: SelfAccessPanelProps) {
  const t = useTranslations('team');

  const roleLabel = (role: WorkspaceRole | ClinicRole | null) => {
    if (!role) return t('selfAccess.none');
    return t(`roles.${role}`);
  };

  const description = clinicName
    ? t('selfAccess.description', { clinic: clinicName })
    : t('selfAccess.descriptionNoClinic');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg font-medium">
            {t('selfAccess.title')}
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('selfAccess.workspaceRole')}
            </p>
            <Badge variant="outline">{roleLabel(workspaceRole)}</Badge>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('selfAccess.clinicRole')}
            </p>
            <Badge variant="outline">{roleLabel(clinicRole)}</Badge>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('selfAccess.permissionsTitle')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {KEY_PERMISSIONS.map((item) => {
              const allowed = permissions[item.key] === true;
              const Icon = allowed ? CheckCircle2 : XCircle;
              return (
                <div key={item.key} className="flex items-center gap-2 text-sm">
                  <Icon
                    className={allowed ? 'h-4 w-4 text-emerald-500' : 'h-4 w-4 text-muted-foreground'}
                  />
                  <span>{t(item.label)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t('selfAccess.footer')}
        </div>
      </CardContent>
    </Card>
  );
}
