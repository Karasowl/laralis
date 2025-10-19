// =====================================================
// LIMPIAR CACHÉ DEL NAVEGADOR COMPLETAMENTE
// =====================================================
// Este script elimina TODO el caché relacionado con la aplicación:
// - Cookies (clinicId, workspaceId, auth tokens)
// - localStorage
// - sessionStorage
// - Service Workers
// - Cache API
// - IndexedDB
//
// CÓMO USAR:
// 1. Abrir la aplicación en el navegador
// 2. Presionar F12 (DevTools)
// 3. Ir a la pestaña "Console"
// 4. Copiar TODO este script
// 5. Pegar en la consola
// 6. Presionar Enter
// 7. Recargar la página (Ctrl+Shift+R)
// =====================================================

(async function clearAllCache() {
    console.log('');
    console.log('========================================');
    console.log('🧹 LIMPIANDO CACHÉ COMPLETO');
    console.log('========================================');
    console.log('');

    let totalCleared = 0;

    // ============================================================================
    // 1. LIMPIAR COOKIES
    // ============================================================================
    console.log('1️⃣ Limpiando cookies...');
    const cookies = document.cookie.split(';');
    let cookiesCleared = 0;

    for (let cookie of cookies) {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

        // Borrar cookie en todos los dominios y paths posibles
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + location.hostname;
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + location.hostname;

        cookiesCleared++;
        console.log(`  ✓ Borrada: ${name}`);
    }

    console.log(`  ✅ ${cookiesCleared} cookies eliminadas`);
    console.log('');
    totalCleared += cookiesCleared;

    // ============================================================================
    // 2. LIMPIAR LOCAL STORAGE
    // ============================================================================
    console.log('2️⃣ Limpiando localStorage...');
    const localStorageSize = localStorage.length;

    if (localStorageSize > 0) {
        // Mostrar qué se va a borrar
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            console.log(`  ✓ ${key}: ${localStorage.getItem(key)?.substring(0, 50)}...`);
        }
        localStorage.clear();
        console.log(`  ✅ ${localStorageSize} items eliminados de localStorage`);
    } else {
        console.log('  ℹ️ localStorage ya estaba vacío');
    }
    console.log('');
    totalCleared += localStorageSize;

    // ============================================================================
    // 3. LIMPIAR SESSION STORAGE
    // ============================================================================
    console.log('3️⃣ Limpiando sessionStorage...');
    const sessionStorageSize = sessionStorage.length;

    if (sessionStorageSize > 0) {
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            console.log(`  ✓ ${key}`);
        }
        sessionStorage.clear();
        console.log(`  ✅ ${sessionStorageSize} items eliminados de sessionStorage`);
    } else {
        console.log('  ℹ️ sessionStorage ya estaba vacío');
    }
    console.log('');
    totalCleared += sessionStorageSize;

    // ============================================================================
    // 4. LIMPIAR INDEXEDDB
    // ============================================================================
    console.log('4️⃣ Limpiando IndexedDB...');

    try {
        const databases = await indexedDB.databases();
        let dbsCleared = 0;

        for (let db of databases) {
            if (db.name) {
                indexedDB.deleteDatabase(db.name);
                console.log(`  ✓ DB borrada: ${db.name}`);
                dbsCleared++;
            }
        }

        if (dbsCleared > 0) {
            console.log(`  ✅ ${dbsCleared} bases de datos eliminadas`);
        } else {
            console.log('  ℹ️ No había bases de datos IndexedDB');
        }
        totalCleared += dbsCleared;
    } catch (e) {
        console.log('  ⚠️ No se pudo limpiar IndexedDB:', e.message);
    }
    console.log('');

    // ============================================================================
    // 5. LIMPIAR CACHE API
    // ============================================================================
    console.log('5️⃣ Limpiando Cache API (Service Workers)...');

    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            let cachesCleared = 0;

            for (let cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log(`  ✓ Cache borrado: ${cacheName}`);
                cachesCleared++;
            }

            if (cachesCleared > 0) {
                console.log(`  ✅ ${cachesCleared} caches eliminados`);
            } else {
                console.log('  ℹ️ No había caches');
            }
            totalCleared += cachesCleared;
        } catch (e) {
            console.log('  ⚠️ No se pudo limpiar Cache API:', e.message);
        }
    } else {
        console.log('  ℹ️ Cache API no disponible');
    }
    console.log('');

    // ============================================================================
    // 6. DESREGISTRAR SERVICE WORKERS
    // ============================================================================
    console.log('6️⃣ Desregistrando Service Workers...');

    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            let swCleared = 0;

            for (let registration of registrations) {
                await registration.unregister();
                console.log(`  ✓ Service Worker desregistrado: ${registration.scope}`);
                swCleared++;
            }

            if (swCleared > 0) {
                console.log(`  ✅ ${swCleared} Service Workers desregistrados`);
            } else {
                console.log('  ℹ️ No había Service Workers');
            }
            totalCleared += swCleared;
        } catch (e) {
            console.log('  ⚠️ No se pudo desregistrar Service Workers:', e.message);
        }
    } else {
        console.log('  ℹ️ Service Workers no disponibles');
    }
    console.log('');

    // ============================================================================
    // 7. VERIFICACIÓN FINAL
    // ============================================================================
    console.log('========================================');
    console.log('VERIFICACIÓN FINAL');
    console.log('========================================');
    console.log('');

    // Verificar cookies
    const cookiesRemaining = document.cookie.split(';').filter(c => c.trim()).length;
    if (cookiesRemaining === 0) {
        console.log('  ✅ Cookies: LIMPIO (0 cookies)');
    } else {
        console.log(`  ⚠️ Cookies: ${cookiesRemaining} cookies restantes`);
        console.log('     ', document.cookie);
    }

    // Verificar localStorage
    if (localStorage.length === 0) {
        console.log('  ✅ localStorage: LIMPIO (0 items)');
    } else {
        console.log(`  ⚠️ localStorage: ${localStorage.length} items restantes`);
    }

    // Verificar sessionStorage
    if (sessionStorage.length === 0) {
        console.log('  ✅ sessionStorage: LIMPIO (0 items)');
    } else {
        console.log(`  ⚠️ sessionStorage: ${sessionStorage.length} items restantes`);
    }

    console.log('');
    console.log('========================================');

    if (totalCleared > 0) {
        console.log(`✅ LIMPIEZA COMPLETADA`);
        console.log(`   ${totalCleared} items eliminados en total`);
    } else {
        console.log('ℹ️ Ya estaba todo limpio');
    }

    console.log('========================================');
    console.log('');
    console.log('📋 SIGUIENTE PASO:');
    console.log('  1. Recargar la página (Ctrl+Shift+R o Cmd+Shift+R)');
    console.log('  2. Verificar que NO aparezcan clínicas fantasma');
    console.log('  3. Registrarse como nuevo usuario');
    console.log('  4. Completar el onboarding desde cero');
    console.log('');
    console.log('⚠️ IMPORTANTE:');
    console.log('  - Si siguen apareciendo clínicas fantasma:');
    console.log('    → Cerrar TODAS las pestañas de la aplicación');
    console.log('    → Abrir navegador en modo incógnito');
    console.log('    → Probar ahí (garantiza estado 100% limpio)');
    console.log('');

})();

// =====================================================
// ALTERNATIVA: Usar Application Tab en DevTools
// =====================================================
//
// Si prefieres hacerlo manualmente:
//
// 1. F12 → Application tab
// 2. Storage → Clear site data
// 3. Marcar TODAS las opciones:
//    ✓ Cookies
//    ✓ Local and session storage
//    ✓ IndexedDB
//    ✓ Web SQL
//    ✓ Cache storage
//    ✓ Service workers
// 4. Click "Clear site data"
// 5. Recargar página (Ctrl+Shift+R)
//
// =====================================================
