'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PermissionMatrix } from './PermissionMatrix';
import { WORKSPACE_ROLES, CLINIC_ROLES, type PermissionMap, type CustomRoleTemplate, type RoleScope } from '@/lib/permissions/types';
import { Loader2, Save, RotateCcw } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(500).optional().nullable(),
  scope: z.enum(['workspace', 'clinic']),
  base_role: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface CustomRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: CustomRoleTemplate | null;
  defaultScope?: RoleScope;
  onCreate: (input: {
    name: string;
    description?: string | null;
    scope: RoleScope;
    base_role?: string | null;
    permissions?: PermissionMap | null;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (
    roleId: string,
    input: {
      name?: string;
      description?: string | null;
      base_role?: string | null;
      permissions?: PermissionMap | null;
      is_active?: boolean;
    }
  ) => Promise<{ success: boolean; error?: string }>;
}

export function CustomRoleModal({
  open,
  onOpenChange,
  role,
  defaultScope = 'workspace',
  onCreate,
  onUpdate,
}: CustomRoleModalProps) {
  const t = useTranslations('team');
  const isEditing = Boolean(role);
  const [saving, setSaving] = useState(false);
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionMap | null>(
    role?.permissions ?? null
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: role?.name || '',
      description: role?.description || '',
      scope: (role?.scope as RoleScope) || defaultScope,
      base_role: role?.base_role || null,
    },
  });

  const scope = watch('scope');
  const baseRole = watch('base_role');

  useEffect(() => {
    if (role) {
      reset({
        name: role.name,
        description: role.description || '',
        scope: role.scope,
        base_role: role.base_role || null,
      });
      setPermissionOverrides(role.permissions ?? null);
    } else {
      reset({
        name: '',
        description: '',
        scope: defaultScope,
        base_role: defaultScope === 'clinic' ? 'doctor' : 'editor',
      });
      setPermissionOverrides(null);
    }
  }, [role, defaultScope, reset]);

  const baseRoleOptions = useMemo(() => {
    if (scope === 'clinic') {
      return Object.entries(CLINIC_ROLES);
    }

    return Object.entries(WORKSPACE_ROLES).filter(
      ([key]) => key !== 'owner' && key !== 'super_admin'
    );
  }, [scope]);

  const handleSubmitForm = async (data: FormData) => {
    setSaving(true);
    const payload = {
      name: data.name,
      description: data.description || null,
      scope: data.scope,
      base_role: data.base_role || null,
      permissions: permissionOverrides || null,
    };

    const result = isEditing
      ? await onUpdate(role!.id, {
          name: payload.name,
          description: payload.description,
          base_role: payload.base_role,
          permissions: payload.permissions,
        })
      : await onCreate(payload);

    setSaving(false);

    if (result.success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[95vw] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('customRoles.editTitle') : t('customRoles.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('customRoles.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-5">
          <div className="space-y-2">
            <Label>{t('customRoles.name')}</Label>
            <Input {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">
                {t('customRoles.invalidName')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('customRoles.descriptionLabel')}</Label>
            <Textarea rows={3} {...register('description')} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('customRoles.scopeLabel')}</Label>
              <Select
                value={scope}
                onValueChange={(value) => setValue('scope', value as RoleScope)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">
                    {t('customRoles.scopeWorkspace')}
                  </SelectItem>
                  <SelectItem value="clinic">
                    {t('customRoles.scopeClinic')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('customRoles.baseRole')}</Label>
              <Select
                value={baseRole || 'none'}
                onValueChange={(value) =>
                  setValue('base_role', value === 'none' ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('customRoles.baseRoleNone')}</SelectItem>
                  {baseRoleOptions.map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('customRoles.permissions')}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPermissionOverrides(null)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('customRoles.resetPermissions')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('permissions.customizeHint')}
            </p>
            <PermissionMatrix
              baseRole={(baseRole || null) as any}
              scope={scope}
              overrides={permissionOverrides}
              onChange={setPermissionOverrides}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
