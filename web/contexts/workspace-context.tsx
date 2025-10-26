'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
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
  refreshUser: () => Promise<void>;
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
  refreshUser: async () => {},
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
  const redirectingRef = (typeof window !== 'undefined') ? (window as any).__routeRedirectingRef ?? ((window as any).__routeRedirectingRef = { current: false }) : { current: false };
  const pathname = usePathname();

  // PERFORMANCE: Create Supabase client once using useRef to avoid recreating on every render
  // This prevents ALL useEffects that depend on supabase from re-running unnecessarily
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createSupabaseBrowserClient();
  }
  const supabase = supabaseRef.current;

  // PERFORMANCE: Memoize signOut to prevent recreating on every render
  const signOut = useCallback(async () => {
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
  }, [supabase]);

  // PERFORMANCE: Memoize refreshWorkspaces to prevent recreating on every render
  const refreshWorkspaces = useCallback(async () => {
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
        .order('created_at', { ascending: false});

      if (error) throw error;

      setWorkspaces(data || []);

      if (!data || data.length === 0) {
        setWorkspace(null);

        // 🔥 AUTO-LIMPIEZA: Si no hay workspaces en BD, limpiar localStorage fantasma
        try {
          const hasStaleWorkspace = typeof localStorage !== 'undefined' && localStorage.getItem('selectedWorkspaceId');
          const hasStaleClinic = typeof localStorage !== 'undefined' && localStorage.getItem('selectedClinicId');

          if (hasStaleWorkspace || hasStaleClinic) {
            console.warn('[workspace-context] 🧹 Detectadas clínicas/workspaces fantasma. Auto-limpiando localStorage...');
            localStorage.removeItem('selectedWorkspaceId');
            localStorage.removeItem('selectedClinicId');
            localStorage.removeItem('selectedWorkspaceName');
            localStorage.removeItem('selectedClinicName');

            // Limpiar cookies también
            if (typeof document !== 'undefined') {
              document.cookie = 'workspaceId=; path=/; max-age=0';
              document.cookie = 'clinicId=; path=/; max-age=0';
            }

            console.log('[workspace-context] ✅ LocalStorage limpiado exitosamente');
          }
        } catch (err) {
          console.error('[workspace-context] Error limpiando localStorage:', err);
        }
      } else {
        let preferredId: string | null = null;
        try {
          const m = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )workspaceId=([^;]+)/) : null;
          preferredId = m ? decodeURIComponent(m[1]) : null;
          if (!preferredId && typeof localStorage !== 'undefined') {
            preferredId = localStorage.getItem('selectedWorkspaceId');
          }
        } catch {}

        // 🔥 VALIDACIÓN: Si el workspace preferido no existe en BD, limpiarlo
        const matchPreferred = preferredId ? data.find(ws => ws.id === preferredId) : undefined;
        if (preferredId && !matchPreferred) {
          console.warn(`[workspace-context] 🧹 Workspace ID ${preferredId} no existe en BD. Auto-limpiando...`);
          try {
            localStorage.removeItem('selectedWorkspaceId');
            localStorage.removeItem('selectedClinicId');
            localStorage.removeItem('selectedWorkspaceName');
            localStorage.removeItem('selectedClinicName');
            if (typeof document !== 'undefined') {
              document.cookie = 'workspaceId=; path=/; max-age=0';
              document.cookie = 'clinicId=; path=/; max-age=0';
            }
          } catch {}
        }

        const currentStillValid = workspace && data.some(ws => ws.id === workspace.id);
        const next = (matchPreferred || (currentStillValid ? workspace! : data[0]));
        if (!workspace || next.id !== workspace.id) {
          setWorkspace(next as any);
        }
      }

      // Si no hay workspaces y no estamos en onboarding o auth, redirigir
      const isProtectedRoute = !pathname?.includes('/onboarding') &&
                               !pathname?.includes('/auth') &&
                               !pathname?.includes('/test-auth') &&
                               !pathname?.includes('/setup');

      if ((!data || data.length === 0) && isProtectedRoute) {
        router.push('/onboarding');
        return;
      }

    } catch (err: any) {
      console.error('Error refreshing workspaces:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, workspace, pathname, router, supabase]);

  // PERFORMANCE: Memoize refreshClinics to prevent recreating on every render
  const refreshClinics = useCallback(async () => {
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

      // 🔥 VALIDACIÓN: Verificar si la clínica actual pertenece a este workspace
      let needsNewClinic = false;

      if (currentClinic) {
        const clinicStillExists = data && data.some(c => c.id === currentClinic.id);
        if (!clinicStillExists) {
          console.warn(`[workspace-context] 🧹 Clínica ID ${currentClinic.id} no pertenece al workspace actual. Auto-limpiando...`);
          try {
            localStorage.removeItem('selectedClinicId');
            localStorage.removeItem('selectedClinicName');
            if (typeof document !== 'undefined') {
              document.cookie = 'clinicId=; path=/; max-age=0';
            }
          } catch {}
          needsNewClinic = true;
        }
      } else {
        needsNewClinic = true;
      }

      // Seleccionar primera clínica si es necesario
      if (needsNewClinic && data && data.length > 0) {
        console.log(`[workspace-context] 📍 Seleccionando primera clínica del workspace: ${data[0].name}`);
        setCurrentClinic(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [workspace, currentClinic, supabase]);

  // PERFORMANCE: Memoize refreshUser to prevent recreating on every render
  const refreshUser = useCallback(async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setUser(user);
    } catch (err: any) {
      console.error('Error refreshing user:', err);
      setError(err.message);
    }
  }, [supabase]);

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

  // PERFORMANCE: Split routing logic into two separate effects to reduce re-renders
  // Effect 1: Handle redirect when no workspaces exist
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const path = pathname || '';
    const isAuthRoute = path.startsWith('/auth') || path.startsWith('/test-auth');
    if (isAuthRoute) return;

    if (workspaces.length === 0) {
      // Context hints from cookies/localStorage to avoid early redirects
      let wsCookie: string | null = null;
      let wsLocal: string | null = null;
      try {
        wsLocal = typeof localStorage !== 'undefined' ? localStorage.getItem('selectedWorkspaceId') : null;
        const m = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )workspaceId=([^;]+)/) : null;
        wsCookie = m ? decodeURIComponent(m[1]) : null;
      } catch {}

      // 🔥 IMPORTANTE: Solo confiar en cookies/localStorage si hay workspaces reales en BD
      if (wsCookie || wsLocal) {
        console.warn('[workspace-context] 🔍 Hints de localStorage encontrados pero no hay workspaces en BD');
        console.warn('[workspace-context] ℹ️  Ignorando hints (probablemente datos fantasma de reset)');
      }

      // Sin workspaces en BD, siempre ir a onboarding
      if (!path.startsWith('/onboarding') && !redirectingRef.current) {
        redirectingRef.current = true;
        router.replace('/onboarding');
        const timer = setTimeout(() => { redirectingRef.current = false; }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, user, workspaces.length, pathname, router]); // Router is stable, no need to include

  // PERFORMANCE: Effect 2: Handle redirect when workspace exists but onboarding incomplete
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const path = pathname || '';
    const isAuthRoute = path.startsWith('/auth') || path.startsWith('/test-auth');
    if (isAuthRoute) return;
    if (workspaces.length === 0) return; // Handled by effect 1

    const completed = Boolean(workspace?.onboarding_completed);
    if (workspace && !completed) {
      const allowedPrefixes = ['/setup', '/onboarding', '/assets', '/fixed-costs', '/time', '/supplies', '/services', '/tariffs'];
      const isAllowed = allowedPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
      if (!isAllowed && !redirectingRef.current) {
        redirectingRef.current = true;
        router.replace('/setup');
        const timer = setTimeout(() => { redirectingRef.current = false; }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, user, workspaces.length, workspace?.id, workspace?.onboarding_completed, pathname, router]); // Only depend on specific workspace properties

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

  // PERFORMANCE: Memoize context value to prevent unnecessary re-renders of all consumers
  const contextValue = useMemo(() => ({
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
    refreshUser,
    signOut,
  }), [
    user,
    workspace,
    workspaces,
    currentClinic,
    clinics,
    loading,
    error,
    refreshWorkspaces,
    refreshClinics,
    refreshUser,
    signOut
  ]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
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
