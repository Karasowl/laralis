'use client';

import { useCallback } from 'react';
import { useApi } from './use-api';
import type { ClinicMember, ClinicRole, PermissionMap } from '@/lib/permissions/types';

interface ClinicMembersResponse {
  members: ClinicMember[];
  clinicId: string;
}

interface AddMemberInput {
  user_id: string;
  role: ClinicRole;
  custom_permissions?: PermissionMap;
  custom_role_id?: string | null;
  can_access_all_patients?: boolean;
  assigned_chair?: string;
}

interface UpdateMemberInput {
  role?: ClinicRole;
  custom_permissions?: PermissionMap | null;
  custom_role_id?: string | null;
  can_access_all_patients?: boolean;
  assigned_chair?: string | null;
  schedule?: Record<string, unknown> | null;
  is_active?: boolean;
}

/**
 * Hook to manage clinic members
 *
 * @example
 * const { members, loading, addMember, updateMember, removeMember } = useClinicMembers();
 */
export function useClinicMembers(clinicId?: string) {
  const endpoint = clinicId
    ? `/api/team/clinic-members?clinicId=${clinicId}`
    : '/api/team/clinic-members';

  const { data, loading, error, refetch } = useApi<ClinicMembersResponse>(endpoint);

  /**
   * Add an existing workspace user to the clinic
   */
  const addMember = useCallback(
    async (input: AddMemberInput): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch('/api/team/clinic-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...input,
            clinic_id: clinicId,
          }),
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
    [clinicId, refetch]
  );

  /**
   * Update a clinic member's role, permissions, or settings
   */
  const updateMember = useCallback(
    async (
      memberId: string,
      input: UpdateMemberInput
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/team/clinic-members/${memberId}`, {
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

  /**
   * Remove (deactivate) a member from the clinic
   */
  const removeMember = useCallback(
    async (memberId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/team/clinic-members/${memberId}`, {
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
    members: data?.members ?? [],
    clinicId: data?.clinicId,
    loading,
    error,
    refetch,
    addMember,
    updateMember,
    removeMember,
  };
}
