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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useInvitations } from '@/hooks/use-invitations';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { useWorkspace } from '@/contexts/workspace-context';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { WORKSPACE_ROLES, CLINIC_ROLES } from '@/lib/permissions/types';
import type { Role, PermissionMap, RoleScope } from '@/lib/permissions/types';
import { PermissionMatrix } from './PermissionMatrix';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  message: z.string().max(500).optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: 'workspace' | 'clinic';
  onSuccess?: () => void;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  scope,
  onSuccess,
}: InviteMemberModalProps) {
  const t = useTranslations('team');
  const { createInvitation } = useInvitations();
  const { roles: customRoles } = useCustomRoles(scope);
  const { clinics } = useWorkspace();
  const { currentClinic } = useCurrentClinic();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [customPermissions, setCustomPermissions] = useState<PermissionMap | null>(null);
  const [clinicIds, setClinicIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: scope === 'workspace' ? 'editor' : 'doctor',
      message: '',
    },
  });

  const selectedRole = watch('role');
  const selectedCustomRole = useMemo(
    () => customRoles.find((roleItem) => roleItem.id === customRoleId) || null,
    [customRoles, customRoleId]
  );

  const allClinicsSelected = scope === 'workspace' && clinicIds.length === 0;

  useEffect(() => {
    if (!open) return;
    if (scope === 'clinic' && currentClinic?.id) {
      setClinicIds([currentClinic.id]);
    } else if (scope === 'workspace') {
      setClinicIds([]);
    }
  }, [open, scope, currentClinic?.id]);

  useEffect(() => {
    if (selectedCustomRole?.base_role) {
      setValue('role', selectedCustomRole.base_role as Role);
    }
  }, [selectedCustomRole, setValue]);

  const roles = scope === 'workspace'
    ? Object.entries(WORKSPACE_ROLES).filter(
        ([key]) => key !== 'owner' && key !== 'super_admin'
      )
    : Object.entries(CLINIC_ROLES);

  const toggleAllClinics = (checked: boolean) => {
    if (checked) {
      setClinicIds([]);
    } else {
      setClinicIds(clinics.map((clinic) => clinic.id));
    }
  };

  const toggleClinic = (clinicId: string, checked: boolean) => {
    setClinicIds((prev) => {
      const next = checked ? [...prev, clinicId] : prev.filter((id) => id !== clinicId);
      if (scope === 'clinic' && next.length === 0 && currentClinic?.id) {
        return [currentClinic.id];
      }
      return next.length === 0 ? prev : next;
    });
  };

  const onSubmit = async (data: InviteFormData) => {
    setIsSubmitting(true);

    const result = await createInvitation({
      email: data.email,
      role: data.role as Role,
      scope: scope as RoleScope,
      clinic_ids: clinicIds,
      custom_permissions: customPermissions || undefined,
      custom_role_id: customRoleId || null,
      message: data.message || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      toast.success(t('invite.success'));
      reset();
      onSuccess?.();
    } else {
      toast.error(result.error || t('invite.error'));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      setCustomRoleId(null);
      setCustomPermissions(null);
      setClinicIds([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('invite.title')}</DialogTitle>
          <DialogDescription>{t('invite.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('invite.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('invite.emailPlaceholder')}
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{t('invite.invalidEmail')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">{t('invite.role')}</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('invite.selectRole')} />
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
              onValueChange={(value) =>
                setCustomRoleId(value === 'none' ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('customRoles.selectRole')} />
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

          {scope === 'workspace' && clinics.length > 0 && (
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
                        checked={clinicIds.includes(clinic.id)}
                        onCheckedChange={(value) => toggleClinic(clinic.id, Boolean(value))}
                      />
                      <span>{clinic.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {scope === 'clinic' && clinics.length > 0 && (
            <div className="space-y-2">
              <Label>{t('clinics.assignClinics')}</Label>
              <div className="space-y-2 rounded-md border border-border/70 p-3">
                {clinics.map((clinic) => (
                  <label key={clinic.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={clinicIds.includes(clinic.id)}
                      onCheckedChange={(value) => toggleClinic(clinic.id, Boolean(value))}
                    />
                    <span>{clinic.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('clinics.assignClinicsHint')}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('permissions.customize')}</Label>
            <PermissionMatrix
              baseRole={(selectedCustomRole?.base_role || selectedRole) as any}
              scope={scope}
              overrides={customPermissions}
              onChange={setCustomPermissions}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              {t('invite.message')}{' '}
              <span className="text-muted-foreground text-xs">
                ({t('invite.optional')})
              </span>
            </Label>
            <Textarea
              id="message"
              placeholder={t('invite.messagePlaceholder')}
              rows={3}
              {...register('message')}
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
                <Send className="h-4 w-4" />
              )}
              {t('invite.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
