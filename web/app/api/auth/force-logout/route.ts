import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  // Crear una respuesta HTML simple que fuerce el logout usando JavaScript del lado del cliente
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Forzando cierre de sesión...</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(to br, #eff6ff, #e0e7ff);
        }
        .container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          max-width: 400px;
        }
        h1 { color: #1e40af; }
        p { color: #64748b; margin: 1rem 0; }
        .spinner {
          border: 3px solid #f3f4f6;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          margin-top: 1rem;
        }
        button:hover {
          background: #2563eb;
        }
        .success { color: #10b981; }
        .error { color: #ef4444; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔧 Limpieza de Sesión</h1>
        <div class="spinner"></div>
        <p id="status">Limpiando sesión y cookies...</p>
        <div id="details" style="margin-top: 20px; text-align: left; font-size: 12px; color: #94a3b8;"></div>
        <button onclick="goToLogin()" style="display: none;" id="continueBtn">
          Continuar al Login
        </button>
      </div>

      <script type="module">
        async function cleanupSession() {
          const details = document.getElementById('details');
          const status = document.getElementById('status');
          const continueBtn = document.getElementById('continueBtn');
          
          try {
            // 1. Limpiar localStorage
            details.innerHTML += '<div>✓ Limpiando localStorage...</div>';
            localStorage.clear();
            
            // 2. Limpiar sessionStorage
            details.innerHTML += '<div>✓ Limpiando sessionStorage...</div>';
            sessionStorage.clear();
            
            // 3. Intentar cargar Supabase y cerrar sesión
            details.innerHTML += '<div>✓ Cerrando sesión de Supabase...</div>';
            
            // Importar Supabase dinámicamente
            const { createBrowserClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/ssr@0.5.2/+esm');
            
            const supabase = createBrowserClient(
              '${process.env.NEXT_PUBLIC_SUPABASE_URL}',
              '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}'
            );
            
            await supabase.auth.signOut();
            
            // 4. Limpiar cookies desde el cliente
            details.innerHTML += '<div>✓ Limpiando cookies...</div>';
            document.cookie.split(";").forEach(function(c) { 
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
            
            // 5. Éxito
            status.innerHTML = '<span class="success">✅ Sesión cerrada exitosamente</span>';
            details.innerHTML += '<div style="color: #10b981; margin-top: 10px;">✓ Limpieza completa</div>';
            
          } catch (error) {
            console.error('Error durante limpieza:', error);
            status.innerHTML = '<span class="error">⚠️ Error al cerrar sesión, pero puedes continuar</span>';
            details.innerHTML += '<div style="color: #ef4444;">Error: ' + error.message + '</div>';
          }
          
          // Mostrar botón para continuar
          document.querySelector('.spinner').style.display = 'none';
          continueBtn.style.display = 'inline-block';
          
          // Redirigir automáticamente después de 2 segundos
          setTimeout(() => {
            window.location.href = '/auth/login';
          }, 2000);
        }
        
        // Ejecutar limpieza al cargar
        cleanupSession();
        
        window.goToLogin = function() {
          window.location.href = '/auth/login';
        }
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      // Headers para limpiar cookies desde el servidor también
      'Set-Cookie': [
        'workspaceId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'clinicId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'sb-refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      ].join(', ')
    },
  });
}