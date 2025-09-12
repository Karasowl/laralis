'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

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
  user: User | null;
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
  signOut: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  user: null,
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
  signOut: async () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Crear cliente de Supabase para el browser
  const supabase = createSupabaseBrowserClient();

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Limpiar estado local
      setUser(null);
      setWorkspace(null);
      setWorkspaces([]);
      setCurrentClinic(null);
      setClinics([]);
      
      // Limpiar almacenamiento local
      localStorage.clear();
      sessionStorage.clear();
      
      // Forzar recarga completa para limpiar todo el estado
      window.location.href = '/auth/login';
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err);
      // Incluso si hay error, intentar limpiar y redirigir
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/auth/login';
    }
  };

  const refreshWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWorkspaces(data || []);
      
      // Si no hay workspaces y no estamos en onboarding o auth, redirigir
      const isProtectedRoute = !pathname?.includes('/onboarding') && 
                               !pathname?.includes('/auth') && 
                               !pathname?.includes('/test-auth');
      
      if ((!data || data.length === 0) && isProtectedRoute) {
        router.push('/onboarding');
        return;
      }
      
      // Si no hay workspace seleccionado, seleccionar el primero
      if (!workspace && data && data.length > 0) {
        setWorkspace(data[0]);
      }
    } catch (err: any) {
      console.error('Error refreshing workspaces:', err);
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

  // Manejar autenticación
  useEffect(() => {
    let mounted = true;
    
    // Obtener usuario inicial
    const initAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) {
          setUser(user);
          if (!user) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error getting user:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    initAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          
          if (event === 'SIGNED_OUT') {
            setWorkspace(null);
            setWorkspaces([]);
            setCurrentClinic(null);
            setClinics([]);
            setLoading(false);
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // Cuando el usuario se autentica, esperar a que se carguen los workspaces
            // antes de cambiar el estado de loading
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Cargar workspaces cuando el usuario cambie
  useEffect(() => {
    if (user) {
      refreshWorkspaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (workspace) {
      refreshClinics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      try {
        document.cookie = `clinicId=${currentClinic.id}; path=/; max-age=31536000`;
      } catch {}
    }
  }, [currentClinic]);

  return (
    <WorkspaceContext.Provider
      value={{
        user,
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
        signOut,
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
