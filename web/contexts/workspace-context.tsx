'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  settings?: any;
  onboarding_completed: boolean;
  onboarding_step: number;
}

interface Clinic {
  id: string;
  workspace_id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  workspaces: Workspace[];
  currentClinic: Clinic | null;
  clinics: Clinic[];
  loading: boolean;
  error: string | null;
  setWorkspace: (workspace: Workspace) => void;
  setCurrentClinic: (clinic: Clinic) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshClinics: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: null,
  workspaces: [],
  currentClinic: null,
  clinics: [],
  loading: true,
  error: null,
  setWorkspace: () => {},
  setCurrentClinic: () => {},
  refreshWorkspaces: async () => {},
  refreshClinics: async () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Reutilizar un singleton del cliente en browser para evitar múltiples GoTrueClient
  const [supabase] = useState(() => getSupabaseBrowserClient());

  const refreshWorkspaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWorkspaces(data || []);
      
      // Si no hay workspaces y no estamos en onboarding, redirigir
      if ((!data || data.length === 0) && !pathname?.includes('/onboarding')) {
        router.push('/onboarding');
        return;
      }
      
      // Si no hay workspace seleccionado, seleccionar el primero
      if (!workspace && data && data.length > 0) {
        setWorkspace(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshClinics = async () => {
    if (!workspace) {
      setClinics([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setClinics(data || []);
      
      // Si no hay clínica seleccionada, seleccionar la primera
      if (!currentClinic && data && data.length > 0) {
        setCurrentClinic(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  useEffect(() => {
    if (workspace) {
      refreshClinics();
    }
  }, [workspace]);

  // Guardar selección en localStorage
  useEffect(() => {
    if (workspace) {
      localStorage.setItem('selectedWorkspaceId', workspace.id);
    }
  }, [workspace]);

  useEffect(() => {
    if (currentClinic) {
      localStorage.setItem('selectedClinicId', currentClinic.id);
    }
  }, [currentClinic]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaces,
        currentClinic,
        clinics,
        loading,
        error,
        setWorkspace,
        setCurrentClinic,
        refreshWorkspaces,
        refreshClinics,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};