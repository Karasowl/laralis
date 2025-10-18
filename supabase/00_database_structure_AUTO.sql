-- ============================================================================
-- SCRIPT: Descubrir estructura completa de la base de datos
-- Propósito: Conocer TODA la estructura de Supabase automáticamente
-- Este script NO modifica nada, solo muestra información
-- ============================================================================

-- ============================================================================
-- 1. DESCUBRIR TODAS LAS TABLAS
-- ============================================================================

WITH table_info AS (
    SELECT
        t.tablename,
        (SELECT COUNT(*)
         FROM information_schema.columns c
         WHERE c.table_schema = 'public'
         AND c.table_name = t.tablename) as total_columns,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) as table_size
    FROM pg_catalog.pg_tables t
    WHERE t.schemaname = 'public'
)
SELECT
    tablename as "Tabla",
    total_columns as "Total Columnas",
    table_size as "Tamaño"
FROM table_info
ORDER BY tablename;

-- ============================================================================
-- 2. ESTRUCTURA COMPLETA: Todas las columnas de todas las tablas
-- ============================================================================

SELECT
    c.table_name as "Tabla",
    c.ordinal_position as "Pos",
    c.column_name as "Columna",
    c.data_type as "Tipo",
    CASE
        WHEN c.character_maximum_length IS NOT NULL
        THEN c.data_type || '(' || c.character_maximum_length || ')'
        ELSE c.data_type
    END as "Tipo Completo",
    c.is_nullable as "Permite NULL",
    c.column_default as "Valor Default"
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;

-- ============================================================================
-- 3. RELACIONES (Foreign Keys)
-- ============================================================================

SELECT
    tc.table_name as "Tabla Hija",
    kcu.column_name as "Columna FK",
    '->' as " ",
    ccu.table_name as "Tabla Padre",
    ccu.column_name as "Columna Padre",
    rc.delete_rule as "ON DELETE",
    rc.update_rule as "ON UPDATE"
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

SELECT
    tablename as "Tabla",
    indexname as "Índice",
    indexdef as "Definición"
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- 5. CONSTRAINTS (Primary Keys, Unique, Check, etc.)
-- ============================================================================

SELECT
    tc.table_name as "Tabla",
    tc.constraint_name as "Constraint",
    tc.constraint_type as "Tipo",
    kcu.column_name as "Columna"
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, kcu.column_name;

-- ============================================================================
-- 6. CONTEO DE REGISTROS EN CADA TABLA
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    sql_query TEXT;
    count_result BIGINT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CONTEO DE REGISTROS POR TABLA';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE '%-35s | %s', 'TABLA', 'REGISTROS';
    RAISE NOTICE '%', repeat('-', 60);

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        sql_query := format('SELECT COUNT(*) FROM public.%I', r.tablename);
        EXECUTE sql_query INTO count_result;
        RAISE NOTICE '%-35s | %s', r.tablename, count_result;
    END LOOP;

    RAISE NOTICE '%', repeat('-', 60);
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- 7. RESUMEN GENERAL
-- ============================================================================

SELECT
    'Total de tablas' as "Métrica",
    COUNT(*)::text as "Valor"
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'

UNION ALL

SELECT
    'Total de columnas',
    COUNT(*)::text
FROM information_schema.columns
WHERE table_schema = 'public'

UNION ALL

SELECT
    'Total de foreign keys',
    COUNT(*)::text
FROM information_schema.table_constraints
WHERE table_schema = 'public'
    AND constraint_type = 'FOREIGN KEY'

UNION ALL

SELECT
    'Total de índices',
    COUNT(*)::text
FROM pg_indexes
WHERE schemaname = 'public';

-- ============================================================================
-- FIN DEL ANÁLISIS
-- ============================================================================

SELECT
    '✅ Análisis de estructura completado' as "Estado",
    'Revisa las tablas anteriores y la sección Messages para ver conteos' as "Nota";
