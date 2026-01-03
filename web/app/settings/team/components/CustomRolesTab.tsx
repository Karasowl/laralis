'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomRoleModal } from './CustomRoleModal';
import { useCustomRoles } from '@/hooks/use-custom-roles';
import { Can } from '@/components/auth';
import { WORKSPACE_ROLES, CLINIC_ROLES, type CustomRoleTemplate, type RoleScope } from '@/lib/permissions/types';
import { Edit, Plus, Trash2 } from 'lucide-react';

export function CustomRolesTab() {
  const t = useTranslations('team');
  const [scope, setScope] = useState<RoleScope>('workspace');
  const { roles, loading, createRole, updateRole, deleteRole } = useCustomRoles(scope);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRoleTemplate | null>(null);
  const [deletingRole, setDeletingRole] = useState<CustomRoleTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const roleLabels = useMemo(() => {
    return scope === 'clinic' ? CLINIC_ROLES : WORKSPACE_ROLES;
  }, [scope]);

  const handleDelete = async () => {
    if (!deletingRole) return;
    setDeleting(true);
    const result = await deleteRole(deletingRole.id);
    setDeleting(false);

    if (result.success) {
      setDeletingRole(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-medium">
              {t('customRoles.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('customRoles.subtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={scope} onValueChange={(value) => setScope(value as RoleScope)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">{t('customRoles.scopeWorkspace')}</SelectItem>
                <SelectItem value="clinic">{t('customRoles.scopeClinic')}</SelectItem>
              </SelectContent>
            </Select>
            <Can permission="team.edit_roles">
              <Button className="gap-2" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('customRoles.createButton')}
              </Button>
            </Can>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : roles.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t('customRoles.empty')}
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{role.name}</p>
                      <Badge variant="outline">{t(`customRoles.scope.${role.scope}`)}</Badge>
                      {role.base_role && (
                        <Badge variant="secondary">
                          {roleLabels[role.base_role as keyof typeof roleLabels]?.label || role.base_role}
                        </Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Can permission="team.edit_roles">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setEditingRole(role);
                          setModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Can>
                    <Can permission="team.edit_roles">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setDeletingRole(role)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Can>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CustomRoleModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditingRole(null);
          }
        }}
        role={editingRole || undefined}
        defaultScope={scope}
        onCreate={createRole}
        onUpdate={updateRole}
      />

      <ConfirmDialog
        open={!!deletingRole}
        onOpenChange={(open) => !open && setDeletingRole(null)}
        title={t('customRoles.deleteTitle')}
        description={t('customRoles.deleteDescription', { name: deletingRole?.name })}
        confirmText={t('customRoles.deleteConfirm')}
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
