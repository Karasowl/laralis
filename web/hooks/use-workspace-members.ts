'use client';

import { useCallback } from 'react';
import { useApi } from './use-api';
import type { WorkspaceMember, WorkspaceRole, PermissionMap } from '@/lib/permissions/types';

interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
  workspaceId: string;
}

interface InviteMemberInput {
  email: string;
  role: WorkspaceRole;
  allowed_clinics?: string[];
  custom_permissions?: PermissionMap;
  custom_role_id?: string | null;
  message?: string;
}

interface UpdateMemberInput {
  role?: WorkspaceRole;
  allowed_clinics?: string[];
  custom_permissions?: PermissionMap | null;
  custom_role_id?: string | null;
  is_active?: boolean;
}

/**
 * Hook to manage workspace members
 *
 * @example
 * const { members, loading, inviteMember, updateMember, removeMember } = useWorkspaceMembers();
 */
export function useWorkspaceMembers(workspaceId?: string) {
  const endpoint = workspaceId
    ? `/api/team/workspace-members?workspaceId=${workspaceId}`
    : '/api/team/workspace-members';

  const { data, loading, error, refetch } = useApi<WorkspaceMembersResponse>(
    endpoint,
    { autoFetch: true }
  );

  /**
   * Invite a new member to the workspace
   */
  const inviteMember = useCallback(
    async (input: InviteMemberInput): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch('/api/team/workspace-members', {
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

  /**
   * Update a member's role, permissions, or access
   */
  const updateMember = useCallback(
    async (
      memberId: string,
      input: UpdateMemberInput
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/team/workspace-members/${memberId}`, {
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
   * Remove (deactivate) a member from the workspace
   */
  const removeMember = useCallback(
    async (memberId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/team/workspace-members/${memberId}`, {
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
    workspaceId: data?.workspaceId,
    loading,
    error,
    refetch,
    inviteMember,
    updateMember,
    removeMember,
  };
}
