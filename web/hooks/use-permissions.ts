'use client';

import { useMemo } from 'react';
import { useApi } from './use-api';
import type {
  Permission,
  PermissionMap,
  WorkspaceRole,
  ClinicRole,
} from '@/lib/permissions/types';

interface PermissionsResponse {
  workspaceRole: WorkspaceRole | null;
  clinicRole: ClinicRole | null;
  permissions: PermissionMap;
}

/**
 * Hook to get and check user permissions.
 *
 * @example
 * const { can, canAll, canAny, loading } = usePermissions();
 *
 * if (can('patients.create')) {
 *   // Show create patient button
 * }
 *
 * if (canAny(['expenses.view', 'financial_reports.view'])) {
 *   // Show finance section
 * }
 */
export function usePermissions() {
  const { data, loading, error, refetch } = useApi<PermissionsResponse>(
    '/api/permissions/my',
    { autoFetch: true }
  );

  const permissions = useMemo(() => data?.permissions ?? {}, [data?.permissions]);

  /**
   * Check if user has a specific permission
   */
  const can = (permission: Permission): boolean => {
    if (!data) return false;

    // Owners have all permissions
    if (data.workspaceRole === 'owner' || data.workspaceRole === 'super_admin') {
      return true;
    }

    return permissions[permission] === true;
  };

  /**
   * Check if user has ALL of the specified permissions
   */
  const canAll = (permissionList: Permission[]): boolean => {
    return permissionList.every((p) => can(p));
  };

  /**
   * Check if user has ANY of the specified permissions
   */
  const canAny = (permissionList: Permission[]): boolean => {
    return permissionList.some((p) => can(p));
  };

  /**
   * Check if user CANNOT do something
   */
  const cannot = (permission: Permission): boolean => {
    return !can(permission);
  };

  /**
   * Check if user is an admin (workspace or clinic level)
   */
  const isAdmin = useMemo(() => {
    if (!data) return false;
    const wsAdminRoles: WorkspaceRole[] = ['owner', 'super_admin', 'admin'];
    return (
      (data.workspaceRole && wsAdminRoles.includes(data.workspaceRole)) ||
      data.clinicRole === 'admin'
    );
  }, [data]);

  /**
   * Check if user is owner or super_admin
   */
  const isSuperUser = useMemo(() => {
    if (!data) return false;
    return data.workspaceRole === 'owner' || data.workspaceRole === 'super_admin';
  }, [data]);

  return {
    // Data
    workspaceRole: data?.workspaceRole ?? null,
    clinicRole: data?.clinicRole ?? null,
    permissions,

    // Permission checks
    can,
    canAll,
    canAny,
    cannot,

    // Role checks
    isAdmin,
    isSuperUser,

    // State
    loading,
    error,
    refetch,
  };
}

/**
 * Shorthand hook to check a single permission
 *
 * @example
 * const canCreatePatient = useCanDo('patients.create');
 */
export function useCanDo(permission: Permission): boolean {
  const { can, loading } = usePermissions();

  if (loading) return false;
  return can(permission);
}

/**
 * Hook to check permission via API (for server-side validation)
 * Use this when you need to verify permission before an action
 *
 * @example
 * const { check, checking } = usePermissionCheck();
 *
 * const handleDelete = async () => {
 *   const allowed = await check('patients.delete');
 *   if (!allowed) {
 *     toast.error('No tienes permiso');
 *     return;
 *   }
 *   // proceed with delete
 * };
 */
export function usePermissionCheck() {
  const check = async (
    permission: Permission,
    options?: { clinicId?: string }
  ): Promise<boolean> => {
    try {
      const params = new URLSearchParams({
        resource: permission.split('.')[0],
        action: permission.split('.')[1],
      });

      if (options?.clinicId) {
        params.set('clinicId', options.clinicId);
      }

      const response = await fetch(`/api/permissions/check?${params}`);
      const data = await response.json();

      return data.allowed === true;
    } catch {
      return false;
    }
  };

  return { check };
}
