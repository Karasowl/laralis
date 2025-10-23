'use client';

import { useMemo } from 'react';
import { useCurrentClinic } from './use-current-clinic';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  onboarding_completed: boolean;
  onboarding_step?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to get the current workspace based on the current clinic.
 *
 * Since every clinic belongs to a workspace, we derive the workspace
 * from the currently selected clinic.
 */
export function useCurrentWorkspace() {
  const { currentClinic, loading, error } = useCurrentClinic();

  const workspace = useMemo<Workspace | null>(() => {
    if (!currentClinic) return null;

    // The clinic object should have workspace_id and optionally workspace data
    // If we only have workspace_id, we create a minimal workspace object
    // In a real implementation, you might want to fetch the full workspace data
    if ('workspace' in currentClinic && currentClinic.workspace) {
      return currentClinic.workspace as Workspace;
    }

    // Fallback: if we only have workspace_id
    if ('workspace_id' in currentClinic && currentClinic.workspace_id) {
      return {
        id: currentClinic.workspace_id as string,
        name: 'Workspace', // Placeholder
        slug: '',
        onboarding_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return null;
  }, [currentClinic]);

  return {
    workspace,
    loading,
    error,
  };
}
