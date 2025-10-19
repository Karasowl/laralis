-- =====================================================
-- DIAGNÓSTICO: Estado actual de RLS
-- =====================================================
-- Este script verifica qué tablas, funciones y políticas
-- existen actualmente para diagnosticar problemas
-- =====================================================

-- ===========================================
-- 1. VERIFICAR TABLAS WORKSPACE
-- ===========================================
-- ¿Cuál tabla existe: workspace_users o workspace_members?
SELECT 'WORKSPACE TABLES CHECK' as section;

SELECT
    table_name,
    CASE
        WHEN table_name = 'workspace_users' THEN '✅ EXISTE (tabla vieja)'
        WHEN table_name = 'workspace_members' THEN '✅ EXISTE (tabla nueva)'
        ELSE '❓ OTRA TABLA'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('workspace_users', 'workspace_members');

-- ===========================================
-- 2. VERIFICAR FUNCIONES HELPER
-- ===========================================
SELECT 'HELPER FUNCTIONS CHECK' as section;

SELECT
    proname as function_name,
    '✅ EXISTE' as status
FROM pg_proc
WHERE proname IN ('user_has_workspace_access', 'user_has_clinic_access')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Mostrar código de las funciones si existen
SELECT
    proname as function_name,
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN ('user_has_workspace_access', 'user_has_clinic_access')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ===========================================
-- 3. VERIFICAR RLS HABILITADO
-- ===========================================
SELECT 'RLS ENABLED CHECK' as section;

SELECT
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS ACTIVO' ELSE '❌ RLS INACTIVO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs', 'tariffs', 'settings_time',
        'custom_categories', 'patient_sources'
    )
ORDER BY tablename;

-- ===========================================
-- 4. CONTAR POLÍTICAS POR TABLA
-- ===========================================
SELECT 'POLICY COUNT BY TABLE' as section;

SELECT
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) >= 4 THEN '✅ COMPLETO (4+)'
        WHEN COUNT(*) >= 2 THEN '⚠️ PARCIAL (2-3)'
        WHEN COUNT(*) = 1 THEN '❌ INCOMPLETO (1)'
        ELSE '❌ SIN POLÍTICAS (0)'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
GROUP BY tablename
ORDER BY policy_count DESC, tablename;

-- Mostrar tablas SIN políticas
SELECT 'TABLES WITHOUT POLICIES' as section;

SELECT
    t.tablename,
    '❌ SIN POLÍTICAS RLS' as problema
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
  AND p.policyname IS NULL
GROUP BY t.tablename
ORDER BY t.tablename;

-- ===========================================
-- 5. LISTAR POLÍTICAS EXISTENTES
-- ===========================================
SELECT 'EXISTING POLICIES DETAIL' as section;

SELECT
    tablename,
    policyname,
    cmd as command,
    CASE
        WHEN cmd = 'SELECT' THEN '🔍 READ'
        WHEN cmd = 'INSERT' THEN '➕ CREATE'
        WHEN cmd = 'UPDATE' THEN '✏️ UPDATE'
        WHEN cmd = 'DELETE' THEN '🗑️ DELETE'
        WHEN cmd = 'ALL' THEN '🔓 ALL'
        ELSE cmd
    END as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
ORDER BY tablename, cmd;

-- ===========================================
-- 6. VERIFICAR WORKSPACE MEMBERS/USERS
-- ===========================================
SELECT 'WORKSPACE MEMBERSHIP CHECK' as section;

-- Si existe workspace_users
SELECT
    'workspace_users' as tabla,
    COUNT(*) as registros,
    '✅ Registros encontrados' as status
FROM workspace_users
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_users')
UNION ALL
-- Si existe workspace_members
SELECT
    'workspace_members' as tabla,
    COUNT(*) as registros,
    '✅ Registros encontrados' as status
FROM workspace_members
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_members');

-- ===========================================
-- RESUMEN FINAL
-- ===========================================
SELECT 'DIAGNOSTIC SUMMARY' as section;

SELECT
    'Tablas con RLS activo' as metrica,
    COUNT(*) as valor
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
UNION ALL
SELECT
    'Tablas SIN políticas RLS',
    COUNT(DISTINCT t.tablename)
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
  AND p.policyname IS NULL
UNION ALL
SELECT
    'Funciones helper existentes',
    COUNT(*)
FROM pg_proc
WHERE proname IN ('user_has_workspace_access', 'user_has_clinic_access')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =====================================================
-- INSTRUCCIONES PARA EL USUARIO
-- =====================================================
--
-- 1. Copia TODO este script
-- 2. Ve a Supabase Dashboard → SQL Editor
-- 3. Pega y ejecuta este script completo
-- 4. Envía los resultados COMPLETOS a Claude
--
-- Esto nos permitirá identificar exactamente qué falta
-- y crear el script de fix apropiado.
-- =====================================================
