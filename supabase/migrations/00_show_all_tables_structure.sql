-- ============================================================================
-- SCRIPT: Mostrar estructura completa de TODAS las tablas de la aplicación
-- Esto nos permite ver los nombres reales de las columnas antes de hacer queries
-- ============================================================================

-- ============================================================================
-- 1. LISTA DE TODAS LAS TABLAS EN public
-- ============================================================================

SELECT '=== TABLAS DISPONIBLES EN public ===' as section;

SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 2. ESTRUCTURA DETALLADA DE CADA TABLA
-- ============================================================================

-- Función para mostrar columnas de una tabla con tipos de datos
SELECT '=== ESTRUCTURA DE TABLAS ===' as section;

SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c
    ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================================================
-- 3. FOREIGN KEYS (Relaciones entre tablas)
-- ============================================================================

SELECT '=== FOREIGN KEYS (Relaciones) ===' as section;

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 4. ÍNDICES
-- ============================================================================

SELECT '=== ÍNDICES ===' as section;

SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- 5. CONTEO DE REGISTROS POR TABLA
-- ============================================================================

SELECT '=== CONTEO DE REGISTROS ===' as section;

-- Esta es una forma dinámica de contar registros en todas las tablas
DO $$
DECLARE
    r RECORD;
    sql_query TEXT;
    count_result INTEGER;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        sql_query := format('SELECT COUNT(*) FROM public.%I', r.tablename);
        EXECUTE sql_query INTO count_result;
        RAISE NOTICE '% : % registros', r.tablename, count_result;
    END LOOP;
END $$;

-- ============================================================================
-- 6. ESTRUCTURA ESPECÍFICA DE TABLAS PRINCIPALES
-- ============================================================================

SELECT '=== WORKSPACES ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspaces'
ORDER BY ordinal_position;

SELECT '=== WORKSPACE_MEMBERS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspace_members'
ORDER BY ordinal_position;

SELECT '=== CLINICS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clinics'
ORDER BY ordinal_position;

SELECT '=== SETTINGS_TIME ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'settings_time'
ORDER BY ordinal_position;

SELECT '=== FIXED_COSTS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fixed_costs'
ORDER BY ordinal_position;

SELECT '=== ASSETS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'assets'
ORDER BY ordinal_position;

SELECT '=== SUPPLIES ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'supplies'
ORDER BY ordinal_position;

SELECT '=== SERVICES ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'services'
ORDER BY ordinal_position;

SELECT '=== SERVICE_SUPPLIES ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'service_supplies'
ORDER BY ordinal_position;

SELECT '=== PATIENTS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'patients'
ORDER BY ordinal_position;

SELECT '=== TREATMENTS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'treatments'
ORDER BY ordinal_position;

SELECT '=== EXPENSES ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'expenses'
ORDER BY ordinal_position;

SELECT '=== TARIFFS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tariffs'
ORDER BY ordinal_position;

SELECT '=== CATEGORIES ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'categories'
ORDER BY ordinal_position;

SELECT '=== MARKETING_CAMPAIGNS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

SELECT '=== MARKETING_PLATFORMS ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'marketing_platforms'
ORDER BY ordinal_position;

SELECT '=== MARKETING_CAMPAIGN_STATUS_HISTORY ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'marketing_campaign_status_history'
ORDER BY ordinal_position;

SELECT '=== WORKSPACE_ACTIVITY ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspace_activity'
ORDER BY ordinal_position;

-- ============================================================================
-- FIN DEL ANÁLISIS DE ESTRUCTURA
-- ============================================================================

SELECT '========================================' as final;
SELECT '✅ Análisis de estructura completo' as final;
SELECT 'Usa esta información para crear queries correctos' as final;
SELECT '========================================' as final;
