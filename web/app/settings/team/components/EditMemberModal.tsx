'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceMembers } from '@/hooks/use-workspace-members';
import { useClinicMembers } from '@/hooks/use-clinic-members';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { useWorkspace } from '@/contexts/workspace-context';
import {
  WORKSPACE_ROLES,
  CLINIC_ROLES,
  type PermissionMap,
  type WorkspaceMember,
  type ClinicMember,
  type WorkspaceRole,
  type ClinicRole,
} from '@/lib/permissions/types';
import { PermissionMatrix } from './PermissionMatrix';

const editSchema = z.object({
  role: z.string().min(1),
});

type EditFormData = z.infer<typeof editSchema>;

interface EditMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WorkspaceMember | ClinicMember;
  scope: 'workspace' | 'clinic';
  onSuccess?: () => void;
}

export function EditMemberModal({
  open,
  onOpenChange,
  member,
  scope,
  onSuccess,
}: EditMemberModalProps) {
  const t = useTranslations('team');
  const { updateMember: updateWorkspaceMember } = useWorkspaceMembers();
  const { updateMember: updateClinicMember } = useClinicMembers();
  const { clinics } = useWorkspace();
  const { roles: customRoles } = useCustomRoles(scope);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isWorkspaceScope = scope === 'workspace';
  const initialAllowedClinics = isWorkspaceScope
    ? (member as WorkspaceMember).allowed_clinics || []
    : [];
  const [allowedClinics, setAllowedClinics] = useState<string[]>(initialAllowedClinics);
  const [customRoleId, setCustomRoleId] = useState<string | null>(
    member.custom_role_id || null
  );
  const [customPermissions, setCustomPermissions] = useState<PermissionMap | null>(
    member.custom_permissions || null
  );
  const workspaceRole =
    scope === 'clinic' ? (member as ClinicMember).workspace_role || null : null;
  const hasWorkspaceOverride =
    workspaceRole === 'owner' || workspaceRole === 'super_admin';

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      role: member.role,
    },
  });

  const selectedRole = watch('role');
  const selectedCustomRole = useMemo(
    () => customRoles.find((roleItem) => roleItem.id === customRoleId) || null,
    [customRoles, customRoleId]
  );
  const matrixBaseRole = hasWorkspaceOverride
    ? workspaceRole
    : (selectedCustomRole?.base_role || selectedRole);

  useEffect(() => {
    setValue('role', member.role);
    setCustomRoleId(member.custom_role_id || null);
    setCustomPermissions(member.custom_permissions || null);
    if (isWorkspaceScope) {
      const nextAllowed = (member as WorkspaceMember).allowed_clinics || [];
      setAllowedClinics(nextAllowed);
    }
  }, [member, isWorkspaceScope, setValue]);

  const roles =
    scope === 'workspace'
      ? Object.entries(WORKSPACE_ROLES).filter(
          ([key]) => key !== 'owner' && key !== 'super_admin'
        )
      : Object.entries(CLINIC_ROLES);

  const allClinicsSelected = isWorkspaceScope && allowedClinics.length === 0;

  const toggleAllClinics = (checked: boolean) => {
    if (checked) {
      setAllowedClinics([]);
    } else {
      setAllowedClinics(clinics.map((clinic) => clinic.id));
    }
  };

  const toggleClinic = (clinicId: string, checked: boolean) => {
    setAllowedClinics((prev) => {
      const next = checked ? [...prev, clinicId] : prev.filter((id) => id !== clinicId);
      return next.length === 0 ? prev : next;
    });
  };

  const onSubmit = async (data: EditFormData) => {
    setIsSubmitting(true);

    const updateFn =
      scope === 'workspace' ? updateWorkspaceMember : updateClinicMember;
    const updateData: Record<string, unknown> = {
      role: data.role,
    };

    if (scope === 'workspace') {
      updateData.allowed_clinics = allClinicsSelected ? [] : allowedClinics;
    }

    updateData.custom_permissions = customPermissions || null;
    updateData.custom_role_id = customRoleId || null;

    const result = await updateFn(member.id, updateData);

    setIsSubmitting(false);

    if (result.success) {
      toast.success(t('members.updateSuccess'));
      onSuccess?.();
    } else {
      toast.error(result.error || t('members.updateError'));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[95vw] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('members.editTitle')}</DialogTitle>
          <DialogDescription>
            {t('members.editDescription', {
              name: member.full_name || member.email,
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('invite.role')}</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value)}
              disabled={hasWorkspaceOverride}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span>{t(`roles.${key}`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {value.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('customRoles.customRole')}</Label>
            <Select
              value={customRoleId || 'none'}
              onValueChange={(value) => {
                const next = value === 'none' ? null : value;
                setCustomRoleId(next);
                const base = customRoles.find((item) => item.id === next)?.base_role;
                if (base) {
                  setValue('role', base);
                }
              }}
              disabled={hasWorkspaceOverride}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('customRoles.none')}</SelectItem>
                {customRoles.map((roleItem) => (
                  <SelectItem key={roleItem.id} value={roleItem.id}>
                    {roleItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isWorkspaceScope && clinics.length > 0 && (
            <div className="space-y-2">
              <Label>{t('allowedClinics.title')}</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allClinicsSelected}
                  onCheckedChange={(value) => toggleAllClinics(Boolean(value))}
                />
                <span className="text-sm">{t('allowedClinics.all')}</span>
              </div>
              {!allClinicsSelected && (
                <div className="space-y-2 rounded-md border border-border/70 p-3">
                  {clinics.map((clinic) => (
                    <label key={clinic.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allowedClinics.includes(clinic.id)}
                        onCheckedChange={(value) =>
                          toggleClinic(clinic.id, Boolean(value))
                        }
                      />
                      <span>{clinic.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('permissions.customize')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('permissions.customizeHint')}
            </p>
            {hasWorkspaceOverride && (
              <p className="text-xs text-muted-foreground">
                {t('permissions.workspaceOverrideHint', {
                  role: t(`roles.${workspaceRole}`),
                })}
              </p>
            )}
            <PermissionMatrix
              baseRole={(matrixBaseRole || selectedRole) as any}
              scope={scope}
              overrides={customPermissions}
              onChange={setCustomPermissions}
              disabled={hasWorkspaceOverride}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
