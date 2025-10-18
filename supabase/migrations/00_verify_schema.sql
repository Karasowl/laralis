-- ============================================================================
-- SCRIPT PARA VERIFICAR ESTRUCTURA REAL DE LAS TABLAS
-- Ejecuta esto PRIMERO para ver qué columnas existen realmente
-- ============================================================================

-- Ver todas las tablas en public schema
SELECT
    '=== TABLAS EN PUBLIC SCHEMA ===' as info;

SELECT
    table_name,
    (SELECT COUNT(*)
     FROM information_schema.columns c
     WHERE c.table_schema = 'public'
     AND c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- Ver columnas de cada tabla importante
-- ============================================================================

SELECT '=== COLUMNAS DE: workspaces ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspaces'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: workspace_members ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspace_members'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: clinics ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clinics'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: patients ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'patients'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: services ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'services'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: supplies ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'supplies'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: treatments ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'treatments'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: expenses ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'expenses'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: fixed_costs ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fixed_costs'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: assets ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'assets'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: service_supplies ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'service_supplies'
ORDER BY ordinal_position;

SELECT '=== COLUMNAS DE: marketing_campaigns ===' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'marketing_campaigns'
ORDER BY ordinal_position;

-- ============================================================================
-- Ver foreign keys (relaciones)
-- ============================================================================

SELECT '=== FOREIGN KEYS Y SUS REGLAS DE CASCADE ===' as info;

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
-- Fin
-- ============================================================================

SELECT '========================================' as final;
SELECT '✅ Verificación de schema completa' as final;
SELECT 'Ahora sabes qué columnas existen realmente' as final;
SELECT '========================================' as final;
