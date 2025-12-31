'use client';

import { useCallback } from 'react';
import { useApi } from './use-api';
import type { InvitationWithInviter, InvitationStatus, Role, PermissionMap } from '@/lib/permissions/types';

interface InvitationsResponse {
  invitations: (InvitationWithInviter & { status: InvitationStatus })[];
  workspaceId: string;
}

interface CreateInvitationInput {
  email: string;
  role: Role;
  clinic_ids?: string[];
  custom_permissions?: PermissionMap;
  message?: string;
}

/**
 * Hook to manage invitations
 *
 * @example
 * const { invitations, loading, createInvitation, resendInvitation, cancelInvitation } = useInvitations();
 */
export function useInvitations(options?: {
  workspaceId?: string;
  status?: InvitationStatus | 'all';
}) {
  const params = new URLSearchParams();
  if (options?.workspaceId) params.set('workspaceId', options.workspaceId);
  if (options?.status) params.set('status', options.status);

  const endpoint = `/api/invitations${params.toString() ? `?${params}` : ''}`;

  const { data, loading, error, refetch } = useApi<InvitationsResponse>(endpoint);

  /**
   * Create a new invitation
   */
  const createInvitation = useCallback(
    async (
      input: CreateInvitationInput
    ): Promise<{ success: boolean; error?: string; invitation?: unknown }> => {
      try {
        const response = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        const result = await response.json();

        if (!response.ok) {
          return { success: false, error: result.error };
        }

        await refetch();
        return { success: true, invitation: result.invitation };
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
   * Resend an invitation (generates new token, extends expiration)
   */
  const resendInvitation = useCallback(
    async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/invitations/${invitationId}/resend`, {
          method: 'POST',
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
   * Cancel a pending invitation
   */
  const cancelInvitation = useCallback(
    async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/invitations?id=${invitationId}`, {
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

  // Filter helpers
  const pendingInvitations =
    data?.invitations.filter((inv) => inv.status === 'pending') ?? [];
  const acceptedInvitations =
    data?.invitations.filter((inv) => inv.status === 'accepted') ?? [];
  const rejectedInvitations =
    data?.invitations.filter((inv) => inv.status === 'rejected') ?? [];
  const expiredInvitations =
    data?.invitations.filter((inv) => inv.status === 'expired') ?? [];

  return {
    invitations: data?.invitations ?? [],
    workspaceId: data?.workspaceId,

    // Filtered lists
    pendingInvitations,
    acceptedInvitations,
    rejectedInvitations,
    expiredInvitations,

    // State
    loading,
    error,
    refetch,

    // Actions
    createInvitation,
    resendInvitation,
    cancelInvitation,
  };
}

/**
 * Hook to accept/reject an invitation (for the invite page)
 *
 * @example
 * const { invitation, loading, accept, reject } = useInvitation(token);
 */
export function useInvitation(token: string) {
  const { data, loading, error, refetch } = useApi<{
    invitation: {
      id: string;
      email: string;
      role: Role;
      message: string | null;
      expires_at: string;
      workspace: { id: string; name: string };
      clinic: { id: string; name: string } | null;
      inviter: { full_name: string | null; email: string };
    };
  }>(`/api/invitations/accept/${token}`);

  /**
   * Accept the invitation (user must be authenticated)
   */
  const accept = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
    workspace_id?: string;
    clinic_id?: string;
  }> => {
    try {
      const response = await fetch(`/api/invitations/accept/${token}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        workspace_id: result.workspace_id,
        clinic_id: result.clinic_id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [token]);

  /**
   * Reject the invitation
   */
  const reject = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/invitations/reject/${token}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [token]);

  return {
    invitation: data?.invitation,
    loading,
    error,
    refetch,
    accept,
    reject,
  };
}
