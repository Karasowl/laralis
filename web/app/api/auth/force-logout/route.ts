import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'


/**
 * JSON-encode + close-tag-safe escape for embedding strings inside
 * inline <script>. Without this, an env var that ever contained
 * `</script>` or backslash sequences would either break parsing or
 * enable XSS on this page.
 */
function safeScriptString(value: string | undefined): string {
  return JSON.stringify(value ?? '')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export async function GET() {
  // Pre-escape env vars so the inline <script> below cannot be broken
  // out of by any future value.
  const supabaseUrl = safeScriptString(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey = safeScriptString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
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
            const addDetail = (text) => {
              const div = document.createElement('div');
              div.textContent = text;
              details.appendChild(div);
            };

            addDetail('✓ Limpiando localStorage...');
            localStorage.clear();

            // 2. Limpiar sessionStorage
            addDetail('✓ Limpiando sessionStorage...');
            sessionStorage.clear();

            // 3. Intentar cargar Supabase y cerrar sesión
            addDetail('✓ Cerrando sesión de Supabase...');
            
            // Importar Supabase dinámicamente
            const { createBrowserClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/ssr@0.5.2/+esm');
            
            const supabase = createBrowserClient(
              ${supabaseUrl},
              ${supabaseAnonKey}
            );
            
            await supabase.auth.signOut();
            
            // 4. Limpiar cookies desde el cliente
            addDetail('✓ Limpiando cookies...');
            document.cookie.split(";").forEach(function(c) { 
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
            
            // 5. Éxito
            status.textContent = '✅ Sesión cerrada exitosamente';
            status.className = 'success';
            const successDiv = document.createElement('div');
            successDiv.textContent = '✓ Limpieza completa';
            successDiv.style.color = '#10b981';
            successDiv.style.marginTop = '10px';
            details.appendChild(successDiv);
            
          } catch (error) {
            console.error('Error durante limpieza:', error);
            status.textContent = '⚠️ Error al cerrar sesión, pero puedes continuar';
            status.className = 'error';
            const errorDiv = document.createElement('div');
            errorDiv.textContent = 'Error: ' + error.message;
            errorDiv.style.color = '#ef4444';
            details.appendChild(errorDiv);
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