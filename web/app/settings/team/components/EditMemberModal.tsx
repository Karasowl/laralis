'use client';

import { useState } from 'react';
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
import {
  WORKSPACE_ROLES,
  CLINIC_ROLES,
  type WorkspaceMember,
  type ClinicMember,
  type WorkspaceRole,
  type ClinicRole,
} from '@/lib/permissions/types';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const roles =
    scope === 'workspace'
      ? Object.entries(WORKSPACE_ROLES).filter(
          ([key]) => key !== 'owner' && key !== 'super_admin'
        )
      : Object.entries(CLINIC_ROLES);

  const onSubmit = async (data: EditFormData) => {
    setIsSubmitting(true);

    const updateFn =
      scope === 'workspace' ? updateWorkspaceMember : updateClinicMember;
    const updateData =
      scope === 'workspace'
        ? { role: data.role as WorkspaceRole }
        : { role: data.role as ClinicRole };

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
      <DialogContent className="sm:max-w-md">
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

          {/* TODO: Add custom permissions editor */}
          {/* <div className="space-y-2">
            <Label>{t('permissions.customize')}</Label>
            <PermissionMatrix
              permissions={member.custom_permissions}
              onChange={(p) => setValue('custom_permissions', p)}
            />
          </div> */}

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
