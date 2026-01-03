'use client';

import { useCallback } from 'react';
import { useApi } from './use-api';
import type { CustomRoleTemplate, PermissionMap, RoleScope } from '@/lib/permissions/types';

interface CustomRolesResponse {
  roles: CustomRoleTemplate[];
}

interface CreateCustomRoleInput {
  name: string;
  description?: string | null;
  scope: RoleScope;
  base_role?: string | null;
  permissions?: PermissionMap | null;
  is_active?: boolean;
}

interface UpdateCustomRoleInput {
  name?: string;
  description?: string | null;
  base_role?: string | null;
  permissions?: PermissionMap | null;
  is_active?: boolean;
}

export function useCustomRoles(scope?: RoleScope) {
  const params = new URLSearchParams();
  if (scope) {
    params.set('scope', scope);
  }

  const endpoint = `/api/team/custom-roles${params.toString() ? `?${params}` : ''}`;

  const { data, loading, error, refetch } = useApi<CustomRolesResponse>(endpoint);

  const createRole = useCallback(
    async (input: CreateCustomRoleInput): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch('/api/team/custom-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const result = await response.json();

        if (!response.ok) {
          return { success: false, error: result.error };
        }

        await refetch();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [refetch]
  );

  const updateRole = useCallback(
    async (
      roleId: string,
      input: UpdateCustomRoleInput
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/team/custom-roles/${roleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const result = await response.json();

        if (!response.ok) {
          return { success: false, error: result.error };
        }

        await refetch();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [refetch]
  );

  const deleteRole = useCallback(
    async (roleId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/team/custom-roles/${roleId}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (!response.ok) {
          return { success: false, error: result.error };
        }

        await refetch();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [refetch]
  );

  return {
    roles: data?.roles ?? [],
    loading,
    error,
    refetch,
    createRole,
    updateRole,
    deleteRole,
  };
}
