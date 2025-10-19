-- =====================================================
-- DIAGNÓSTICO COMPLETO DEL ESTADO ACTUAL
-- =====================================================
-- Este script muestra EXACTAMENTE qué hay en la base de datos
-- Para diagnosticar el problema de "clínicas fantasma"
-- =====================================================

\echo ''
\echo '========================================'
\echo '🔍 DIAGNÓSTICO COMPLETO'
\echo '========================================'
\echo ''

-- =====================================================
-- 1. USUARIOS DE AUTENTICACIÓN
-- =====================================================
\echo '1️⃣  USUARIOS EN AUTH.USERS'
\echo '----------------------------------------'

DO $$
DECLARE
    user_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM auth.users;
    RAISE NOTICE 'Total de usuarios: %', user_count;

    IF user_count = 0 THEN
        RAISE NOTICE '✅ auth.users está VACÍA (correcto si reseteaste)';
    ELSE
        RAISE NOTICE '⚠️  auth.users tiene % usuarios (debería estar vacía)', user_count;
    END IF;
END $$;

SELECT
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

\echo ''

-- =====================================================
-- 2. WORKSPACES
-- =====================================================
\echo '2️⃣  WORKSPACES'
\echo '----------------------------------------'

DO $$
DECLARE
    workspace_count INT;
    orphan_count INT;
BEGIN
    SELECT COUNT(*) INTO workspace_count FROM workspaces;
    RAISE NOTICE 'Total de workspaces: %', workspace_count;

    -- Verificar huérfanos (workspaces sin owner válido)
    SELECT COUNT(*) INTO orphan_count
    FROM workspaces w
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.owner_id);

    IF orphan_count > 0 THEN
        RAISE NOTICE '❌ Hay % workspaces HUÉRFANOS (sin owner válido)', orphan_count;
        RAISE NOTICE '   Esto causa el problema de "clínicas fantasma"';
    END IF;

    IF workspace_count = 0 THEN
        RAISE NOTICE '✅ workspaces está VACÍA';
    END IF;
END $$;

SELECT
    w.id,
    w.name,
    w.owner_id,
    CASE
        WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.owner_id)
        THEN '✅ Owner existe'
        ELSE '❌ HUÉRFANO (owner no existe)'
    END as status,
    w.created_at
FROM workspaces w
ORDER BY w.created_at DESC;

\echo ''

-- =====================================================
-- 3. CLÍNICAS
-- =====================================================
\echo '3️⃣  CLÍNICAS'
\echo '----------------------------------------'

DO $$
DECLARE
    clinic_count INT;
    orphan_count INT;
BEGIN
    SELECT COUNT(*) INTO clinic_count FROM clinics;
    RAISE NOTICE 'Total de clínicas: %', clinic_count;

    -- Verificar huérfanas (clínicas cuyo workspace no tiene owner válido)
    SELECT COUNT(*) INTO orphan_count
    FROM clinics c
    INNER JOIN workspaces w ON c.workspace_id = w.id
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.owner_id);

    IF orphan_count > 0 THEN
        RAISE NOTICE '❌ Hay % clínicas HUÉRFANAS (workspace sin owner)', orphan_count;
        RAISE NOTICE '   Estas son las "clínicas fantasma" que ves';
    END IF;

    IF clinic_count = 0 THEN
        RAISE NOTICE '✅ clinics está VACÍA';
    END IF;
END $$;

SELECT
    c.id,
    c.name,
    c.workspace_id,
    w.name as workspace_name,
    w.owner_id,
    CASE
        WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.owner_id)
        THEN '✅ Owner existe'
        ELSE '❌ HUÉRFANA (owner no existe)'
    END as status,
    c.created_at
FROM clinics c
INNER JOIN workspaces w ON c.workspace_id = w.id
ORDER BY c.created_at DESC;

\echo ''

-- =====================================================
-- 4. OTRAS TABLAS CRÍTICAS
-- =====================================================
\echo '4️⃣  OTRAS TABLAS'
\echo '----------------------------------------'

DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    total_rows BIGINT := 0;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN ('workspaces', 'clinics')
        ORDER BY tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            RAISE NOTICE '%-30s: % registros', r.tablename, row_count;
            total_rows := total_rows + row_count;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE 'Total de registros en otras tablas: %', total_rows;

    IF total_rows > 0 THEN
        RAISE NOTICE '⚠️  Hay datos residuales en la base de datos';
    ELSE
        RAISE NOTICE '✅ Todas las demás tablas están vacías';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 5. CATEGORY_TYPES (necesario para onboarding)
-- =====================================================
\echo '5️⃣  CATEGORY_TYPES'
\echo '----------------------------------------'

DO $$
DECLARE
    cat_count INT;
BEGIN
    SELECT COUNT(*) INTO cat_count FROM category_types;
    RAISE NOTICE 'Total de category_types: %', cat_count;

    IF cat_count >= 4 THEN
        RAISE NOTICE '✅ category_types está correctamente poblada';
    ELSIF cat_count = 0 THEN
        RAISE NOTICE '❌ category_types está VACÍA (onboarding fallará)';
    ELSE
        RAISE NOTICE '⚠️  category_types tiene solo % tipos (debería tener 4)', cat_count;
    END IF;
END $$;

SELECT name, display_name FROM category_types ORDER BY name;

\echo ''

-- =====================================================
-- 6. RESUMEN Y DIAGNÓSTICO FINAL
-- =====================================================
\echo '========================================'
\echo '📋 RESUMEN Y DIAGNÓSTICO'
\echo '========================================'

DO $$
DECLARE
    users_count INT;
    workspaces_count INT;
    clinics_count INT;
    orphan_workspaces INT;
    orphan_clinics INT;
    cat_types_count INT;
    problema TEXT := '';
BEGIN
    -- Contar todo
    SELECT COUNT(*) INTO users_count FROM auth.users;
    SELECT COUNT(*) INTO workspaces_count FROM workspaces;
    SELECT COUNT(*) INTO clinics_count FROM clinics;
    SELECT COUNT(*) INTO cat_types_count FROM category_types;

    -- Contar huérfanos
    SELECT COUNT(*) INTO orphan_workspaces
    FROM workspaces w
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.owner_id);

    SELECT COUNT(*) INTO orphan_clinics
    FROM clinics c
    INNER JOIN workspaces w ON c.workspace_id = w.id
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.owner_id);

    RAISE NOTICE '';
    RAISE NOTICE 'Estado de la base de datos:';
    RAISE NOTICE '  • Usuarios: %', users_count;
    RAISE NOTICE '  • Workspaces: % (% huérfanos)', workspaces_count, orphan_workspaces;
    RAISE NOTICE '  • Clínicas: % (% huérfanas)', clinics_count, orphan_clinics;
    RAISE NOTICE '  • Category types: %', cat_types_count;
    RAISE NOTICE '';

    -- Diagnóstico
    IF users_count = 0 AND workspaces_count = 0 AND clinics_count = 0 THEN
        RAISE NOTICE '✅ ESTADO: Base de datos completamente limpia';
        RAISE NOTICE '   → Puedes registrar nuevo usuario y empezar de cero';
        IF cat_types_count < 4 THEN
            RAISE NOTICE '';
            RAISE NOTICE '⚠️  ADVERTENCIA: category_types no está poblada';
            RAISE NOTICE '   → Ejecuta el script FIX-ONBOARDING-COMPLETO-V3.sql';
        END IF;
    ELSIF users_count = 0 AND (workspaces_count > 0 OR clinics_count > 0) THEN
        RAISE NOTICE '❌ PROBLEMA ENCONTRADO: "Clínicas Fantasma"';
        RAISE NOTICE '';
        RAISE NOTICE 'Explicación:';
        RAISE NOTICE '  • Los usuarios fueron borrados de auth.users ✅';
        RAISE NOTICE '  • Pero las tablas NO fueron vaciadas ❌';
        RAISE NOTICE '  • Hay % workspaces sin owner válido', orphan_workspaces;
        RAISE NOTICE '  • Hay % clínicas sin owner válido', orphan_clinics;
        RAISE NOTICE '';
        RAISE NOTICE 'Esto explica por qué:';
        RAISE NOTICE '  • Ves clínicas viejas en la interfaz';
        RAISE NOTICE '  • No puedes crear nuevas clínicas';
        RAISE NOTICE '  • Las políticas RLS fallan';
        RAISE NOTICE '';
        RAISE NOTICE 'SOLUCIÓN:';
        RAISE NOTICE '  1. Ejecutar: scripts/reset-database-FIXED.sql';
        RAISE NOTICE '  2. Verificar que este script reporte "limpia"';
        RAISE NOTICE '  3. Luego ejecutar: scripts/FIX-ONBOARDING-COMPLETO-V3.sql';
        RAISE NOTICE '  4. Registrar nuevo usuario';
        RAISE NOTICE '  5. Completar onboarding';
    ELSIF users_count > 0 THEN
        RAISE NOTICE 'ℹ️  ESTADO: Base de datos en uso';
        RAISE NOTICE '   → Hay % usuarios registrados', users_count;
        IF orphan_workspaces > 0 OR orphan_clinics > 0 THEN
            RAISE NOTICE '';
            RAISE NOTICE '⚠️  Hay registros huérfanos:';
            RAISE NOTICE '   • % workspaces sin owner', orphan_workspaces;
            RAISE NOTICE '   • % clínicas sin owner', orphan_clinics;
            RAISE NOTICE '';
            RAISE NOTICE 'SOLUCIÓN:';
            RAISE NOTICE '  1. Ejecutar: scripts/cleanup-orphans.sql';
        END IF;
    END IF;

    RAISE NOTICE '';
END $$;

\echo '========================================'
\echo ''

-- =====================================================
-- FIN DEL DIAGNÓSTICO
-- =====================================================
