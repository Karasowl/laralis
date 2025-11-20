'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DebugPage() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    checkAuth();
    checkWorkspaces();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      
      setSession(session);
      setUser(user);
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspace ? [data.workspace] : []);
      }
    } catch (error) {
      console.error('Error checking workspaces:', error);
    }
  };

  const forceLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  const goToOnboarding = () => {
    window.location.href = '/onboarding';
  };

  const goToHome = () => {
    window.location.href = '/';
  };

  if (loading) {
    return <div className="p-8">Cargando información de depuración...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">🔧 Página de Depuración</h1>
        
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Estado de Autenticación</h2>
          <div className="space-y-2">
            <p><strong>Sesión activa:</strong> {session ? '✅ SÍ' : '❌ NO'}</p>
            <p><strong>Usuario:</strong> {user?.email || 'No hay usuario'}</p>
            <p><strong>ID Usuario:</strong> {user?.id || 'N/A'}</p>
            {session && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                <p><strong>Token expira:</strong> {new Date(session.expires_at * 1000).toLocaleString()}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Workspaces</h2>
          <div className="space-y-2">
            <p><strong>Tienes workspace:</strong> {workspaces.length > 0 ? '✅ SÍ' : '❌ NO'}</p>
            {workspaces.length > 0 && (
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <p><strong>Nombre:</strong> {workspaces[0].name}</p>
                <p><strong>ID:</strong> {workspaces[0].id}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Diagnóstico</h2>
          <div className="space-y-2">
            {!session && (
              <p className="text-destructive">❌ No hay sesión activa. Debes iniciar sesión primero.</p>
            )}
            {session && !user && (
              <p className="text-yellow-600">⚠️ Hay sesión pero no se puede obtener el usuario.</p>
            )}
            {session && user && workspaces.length === 0 && (
              <p className="text-primary">📝 Tienes sesión pero no tienes workspace. Debes ir al onboarding.</p>
            )}
            {session && user && workspaces.length > 0 && (
              <p className="text-green-600">✅ Todo está correcto. Puedes ir al home.</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Acciones</h2>
          <div className="flex gap-4">
            <Button 
              onClick={forceLogout} 
              variant="destructive"
              className="flex-1"
            >
              🚪 Forzar Cierre de Sesión
            </Button>
            
            {session && workspaces.length === 0 && (
              <Button 
                onClick={goToOnboarding}
                className="flex-1"
              >
                📝 Ir a Onboarding
              </Button>
            )}
            
            {session && workspaces.length > 0 && (
              <Button 
                onClick={goToHome}
                className="flex-1"
              >
                🏠 Ir al Home
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Información del Sistema</h2>
          <div className="space-y-1 text-sm text-gray-600">
            <p>URL actual: {window.location.href}</p>
            <p>Cookies habilitadas: {navigator.cookieEnabled ? 'SÍ' : 'NO'}</p>
            <p>LocalStorage disponible: {typeof Storage !== 'undefined' ? 'SÍ' : 'NO'}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}