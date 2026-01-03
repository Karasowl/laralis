'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PERMISSION_RESOURCES,
  getAllPermissions,
  getPermissionCategories,
  type Permission,
  type PermissionMap,
  type PermissionResource,
  type WorkspaceRole,
  type ClinicRole,
} from '@/lib/permissions/types';
import {
  getWorkspaceRolePermissions,
  getClinicRolePermissions,
} from '@/lib/permissions/role-templates';
import { cn } from '@/lib/utils';

interface PermissionMatrixProps {
  baseRole?: WorkspaceRole | ClinicRole | null;
  scope?: 'workspace' | 'clinic';
  overrides?: PermissionMap | null;
  onChange: (value: PermissionMap | null) => void;
  disabled?: boolean;
  className?: string;
}

export function PermissionMatrix({
  baseRole,
  scope = 'workspace',
  overrides,
  onChange,
  disabled = false,
  className,
}: PermissionMatrixProps) {
  const t = useTranslations('permissions');

  const basePermissions = useMemo<PermissionMap>(() => {
    if (!baseRole) return {};

    if (baseRole === 'owner' || baseRole === 'super_admin') {
      return getAllPermissions().reduce<PermissionMap>((acc, perm) => {
        acc[perm] = true;
        return acc;
      }, {});
    }

    return scope === 'clinic'
      ? getClinicRolePermissions(baseRole as ClinicRole)
      : getWorkspaceRolePermissions(baseRole as WorkspaceRole);
  }, [baseRole, scope]);

  const effectivePermissions = useMemo<PermissionMap>(() => {
    return {
      ...basePermissions,
      ...(overrides || {}),
    };
  }, [basePermissions, overrides]);

  const categories = getPermissionCategories();

  const togglePermission = (permission: Permission, nextValue: boolean) => {
    const baseValue = basePermissions[permission] === true;
    const nextOverrides: PermissionMap = { ...(overrides || {}) };

    if (nextValue === baseValue) {
      delete nextOverrides[permission];
    } else {
      nextOverrides[permission] = nextValue;
    }

    onChange(Object.keys(nextOverrides).length > 0 ? nextOverrides : null);
  };

  const getResourceLabel = (resource: PermissionResource) => {
    return t(`resources.${resource}`, { defaultValue: formatLabel(resource) });
  };

  const getActionLabel = (action: string) => {
    return t(`actions.${action}`, { defaultValue: formatLabel(action) });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {categories.map((category) => (
        <div key={category.key} className="rounded-lg border border-border/60 p-4">
          <div className="mb-3 text-sm font-semibold">
            {t(`categories.${category.key}`, { defaultValue: category.label })}
          </div>
          <div className="space-y-4">
            {category.resources.map((resource) => {
              const actions = PERMISSION_RESOURCES[resource];
              return (
                <div key={resource} className="space-y-2">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {getResourceLabel(resource)}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {actions.map((action) => {
                      const permission = `${resource}.${action}` as Permission;
                      const checked = effectivePermissions[permission] === true;
                      return (
                        <label
                          key={permission}
                          className={cn(
                            'flex items-center gap-2 rounded-md border border-transparent px-2 py-1',
                            disabled ? 'opacity-60' : 'hover:border-border/70'
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(value) =>
                              togglePermission(permission, Boolean(value))
                            }
                          />
                          <span className="text-sm">
                            {getActionLabel(action)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
