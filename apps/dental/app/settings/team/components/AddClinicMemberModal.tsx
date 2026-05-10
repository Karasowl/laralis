'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PermissionMatrix } from './PermissionMatrix';
import { useWorkspaceMembers } from '@/hooks/use-workspace-members';
import { useClinicMembers } from '@/hooks/use-clinic-members';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { CLINIC_ROLES, type ClinicMember, type ClinicRole, type PermissionMap } from '@/lib/permissions/types';
import { Loader2, UserPlus } from 'lucide-react';

interface AddClinicMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  existingMembers: ClinicMember[];
  onSuccess?: () => void;
}

export function AddClinicMemberModal({
  open,
  onOpenChange,
  clinicId,
  existingMembers,
  onSuccess,
}: AddClinicMemberModalProps) {
  const t = useTranslations('team');
  const { members: workspaceMembers, loading: workspaceLoading } = useWorkspaceMembers();
  const { addMember } = useClinicMembers(clinicId);
  const { roles: customRoles } = useCustomRoles('clinic');

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [role, setRole] = useState<ClinicRole>('doctor');
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [customPermissions, setCustomPermissions] = useState<PermissionMap | null>(null);
  const [saving, setSaving] = useState(false);

  const existingUserIds = useMemo(
    () => new Set(existingMembers.map((member) => member.user_id)),
    [existingMembers]
  );

  const availableMembers = useMemo(
    () => workspaceMembers.filter((member) => !existingUserIds.has(member.user_id) && member.is_active),
    [workspaceMembers, existingUserIds]
  );

  const selectedCustomRole = useMemo(
    () => customRoles.find((r) => r.id === customRoleId) || null,
    [customRoles, customRoleId]
  );

  useEffect(() => {
    if (!open) return;
    if (!selectedUserId && availableMembers.length > 0) {
      setSelectedUserId(availableMembers[0].user_id);
    }
  }, [open, availableMembers, selectedUserId]);

  useEffect(() => {
    if (selectedCustomRole?.base_role) {
      setRole(selectedCustomRole.base_role as ClinicRole);
    }
  }, [selectedCustomRole]);

  const handleSubmit = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    const result = await addMember({
      user_id: selectedUserId,
      role,
      custom_permissions: customPermissions || undefined,
      custom_role_id: customRoleId || null,
    });
    setSaving(false);

    if (result.success) {
      onSuccess?.();
      onOpenChange(false);
      setSelectedUserId('');
      setCustomRoleId(null);
      setCustomPermissions(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[95vw] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('clinics.addMemberTitle')}</DialogTitle>
          <DialogDescription>{t('clinics.addMemberDescription')}</DialogDescription>
        </DialogHeader>

        {workspaceLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('clinics.loadingMembers')}
          </div>
        ) : availableMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('clinics.noAvailableMembers')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('clinics.selectMember')}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('invite.role')}</Label>
                <Select value={role} onValueChange={(value) => setRole(value as ClinicRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLINIC_ROLES).map(([key]) => (
                      <SelectItem key={key} value={key}>
                        {t(`roles.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('customRoles.customRole')}</Label>
                <Select
                  value={customRoleId || 'none'}
                  onValueChange={(value) =>
                    setCustomRoleId(value === 'none' ? null : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('customRoles.none')}</SelectItem>
                    {customRoles.map((customRole) => (
                      <SelectItem key={customRole.id} value={customRole.id}>
                        {customRole.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('permissions.customize')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('permissions.customizeHint')}
              </p>
              <PermissionMatrix
                baseRole={(selectedCustomRole?.base_role || role) as ClinicRole}
                scope="clinic"
                overrides={customPermissions}
                onChange={setCustomPermissions}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !selectedUserId}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {t('clinics.addMember')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
