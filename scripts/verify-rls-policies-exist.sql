-- =================================================================
-- VERIFICACIÓN: ¿Se aplicaron las políticas RLS correctamente?
-- =================================================================

-- PASO 1: Verificar si RLS está habilitado en las tablas
SELECT
    '====== ESTADO DE RLS ======' as seccion;

SELECT
    tablename as tabla,
    CASE WHEN rowsecurity THEN '✅ HABILITADO' ELSE '❌ DESHABILITADO' END as rls_estado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types', 'clinics', 'workspaces')
ORDER BY tablename;

-- PASO 2: Contar políticas por tabla y comando
SELECT
    '====== POLÍTICAS POR TABLA ======' as seccion;

SELECT
    tablename as tabla,
    cmd as comando,
    COUNT(*) as cantidad_politicas,
    STRING_AGG(policyname, ', ') as nombres_politicas
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types', 'clinics', 'workspaces')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- PASO 3: Verificar políticas específicas que DEBEN existir
SELECT
    '====== VERIFICAR POLÍTICAS CRÍTICAS ======' as seccion;

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'patient_sources'
            AND policyname = 'Users can insert patient sources in their clinics'
        ) THEN '✅ patient_sources INSERT policy existe'
        ELSE '❌ patient_sources INSERT policy FALTA'
    END as verificacion
UNION ALL
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'custom_categories'
            AND policyname = 'Users can insert categories in their clinics'
        ) THEN '✅ custom_categories INSERT policy existe'
        ELSE '❌ custom_categories INSERT policy FALTA'
    END
UNION ALL
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'category_types'
            AND policyname = 'Authenticated users can view category types'
        ) THEN '✅ category_types SELECT policy existe'
        ELSE '❌ category_types SELECT policy FALTA'
    END;

-- PASO 4: Mostrar TODAS las políticas existentes con detalles
SELECT
    '====== TODAS LAS POLÍTICAS (DETALLE) ======' as seccion;

SELECT
    tablename as tabla,
    policyname as politica,
    cmd as comando,
    LEFT(COALESCE(qual::text, ''), 100) as condicion_using,
    LEFT(COALESCE(with_check::text, ''), 100) as condicion_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types')
ORDER BY tablename, cmd, policyname;

-- PASO 5: Diagnóstico final
SELECT
    '====== DIAGNÓSTICO FINAL ======' as seccion;

SELECT
    CASE
        WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'patient_sources' AND schemaname = 'public') IS NULL
        THEN '❌ CRÍTICO: Tabla patient_sources NO EXISTE'
        WHEN NOT (SELECT rowsecurity FROM pg_tables WHERE tablename = 'patient_sources' AND schemaname = 'public')
        THEN '❌ CRÍTICO: patient_sources existe pero RLS está DESHABILITADO'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_sources' AND cmd = 'INSERT')
        THEN '❌ CRÍTICO: patient_sources NO tiene política INSERT'
        ELSE '✅ patient_sources OK'
    END as estado_patient_sources
UNION ALL
SELECT
    CASE
        WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'custom_categories' AND schemaname = 'public') IS NULL
        THEN '❌ CRÍTICO: Tabla custom_categories NO EXISTE'
        WHEN NOT (SELECT rowsecurity FROM pg_tables WHERE tablename = 'custom_categories' AND schemaname = 'public')
        THEN '❌ CRÍTICO: custom_categories existe pero RLS está DESHABILITADO'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_categories' AND cmd = 'INSERT')
        THEN '❌ CRÍTICO: custom_categories NO tiene política INSERT'
        ELSE '✅ custom_categories OK'
    END
UNION ALL
SELECT
    CASE
        WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'category_types' AND schemaname = 'public') IS NULL
        THEN '❌ CRÍTICO: Tabla category_types NO EXISTE'
        WHEN NOT (SELECT rowsecurity FROM pg_tables WHERE tablename = 'category_types' AND schemaname = 'public')
        THEN '❌ CRÍTICO: category_types existe pero RLS está DESHABILITADO'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'category_types' AND cmd = 'SELECT')
        THEN '❌ CRÍTICO: category_types NO tiene política SELECT'
        ELSE '✅ category_types OK'
    END;
