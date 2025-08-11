'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function TestAuthPage() {
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkEverything();
  }, []);
  
  const checkEverything = async () => {
    const supabase = createSupabaseBrowserClient();
    const results: any = {};
    
    try {
      // 1. Check session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      results.session = session ? 'YES' : 'NO';
      results.sessionError = sessionError?.message || null;
      results.sessionDetails = session ? {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
      } : null;
      
      // 2. Check user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      results.user = user ? 'YES' : 'NO';
      results.userError = userError?.message || null;
      results.userDetails = user ? {
        id: user.id,
        email: user.email,
        createdAt: user.created_at
      } : null;
      
      // 3. Check workspaces directly
      if (user) {
        const { data: workspaces, error: wsError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('owner_id', user.id);
        
        results.workspaces = workspaces || [];
        results.workspacesError = wsError?.message || null;
      }
      
      // 4. Check localStorage
      results.localStorage = {
        'laralis-auth': localStorage.getItem('laralis-auth') ? 'EXISTS' : 'EMPTY',
        'selectedWorkspaceId': localStorage.getItem('selectedWorkspaceId'),
        'selectedClinicId': localStorage.getItem('selectedClinicId'),
      };
      
      // 5. Check cookies
      results.cookies = document.cookie || 'No cookies';
      
    } catch (error: any) {
      results.generalError = error.message;
    }
    
    setStatus(results);
    setLoading(false);
  };
  
  const forceLogin = async () => {
    const supabase = createSupabaseBrowserClient();
    const email = prompt('Email:');
    const password = prompt('Password:');
    
    if (!email || !password) return;
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        alert('Error: ' + error.message);
      } else {
        alert('Login exitoso! Recargando...');
        window.location.reload();
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };
  
  const forceLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };
  
  const goToOnboarding = () => {
    window.location.replace('/onboarding');
  };
  
  const goToHome = () => {
    window.location.replace('/');
  };
  
  if (loading) {
    return <div className="p-8">Cargando...</div>;
  }
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">🔍 Test de Autenticación</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">1. Estado de Sesión</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify({
              session: status.session,
              sessionError: status.sessionError,
              sessionDetails: status.sessionDetails
            }, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">2. Estado de Usuario</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify({
              user: status.user,
              userError: status.userError,
              userDetails: status.userDetails
            }, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">3. Workspaces</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify({
              count: status.workspaces?.length || 0,
              workspaces: status.workspaces,
              error: status.workspacesError
            }, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">4. LocalStorage</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(status.localStorage, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">5. Cookies</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {status.cookies}
          </pre>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">🎯 Acciones</h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={forceLogin}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              🔐 Forzar Login
            </button>
            
            <button 
              onClick={forceLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              🚪 Forzar Logout
            </button>
            
            <button 
              onClick={goToOnboarding}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              📝 Ir a Onboarding (replace)
            </button>
            
            <button 
              onClick={goToHome}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            >
              🏠 Ir a Home (replace)
            </button>
            
            <button 
              onClick={checkEverything}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              🔄 Recargar Datos
            </button>
            
            <button 
              onClick={() => window.location.reload()}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
            >
              🔃 Recargar Página
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}