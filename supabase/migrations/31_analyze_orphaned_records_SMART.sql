-- ============================================================================
-- ANÁLISIS INTELIGENTE DE DATOS HUÉRFANOS
-- Este script es AUTO-DESCUBRIDOR: detecta automáticamente todas las tablas
-- y sus foreign keys, luego busca datos huérfanos sin necesidad de hardcodear nada
-- ============================================================================

-- ============================================================================
-- PARTE 1: DESCUBRIR ESTRUCTURA AUTOMÁTICAMENTE
-- ============================================================================

-- Mostrar todas las tablas en public
SELECT '=== PASO 1: TABLAS ENCONTRADAS EN LA BASE DE DATOS ===' as info;

SELECT
    schemaname,
    tablename,
    (SELECT COUNT(*)
     FROM information_schema.columns c
     WHERE c.table_schema = schemaname
     AND c.table_name = tablename) as total_columns,
    (SELECT COUNT(*)
     FROM pg_catalog.pg_class c2
     JOIN pg_catalog.pg_namespace n ON n.oid = c2.relnamespace
     WHERE c2.relname = tablename
     AND n.nspname = schemaname
     AND c2.reltuples > 0) as has_data
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- PARTE 2: MOSTRAR TODAS LAS FOREIGN KEYS (Relaciones)
-- ============================================================================

SELECT '=== PASO 2: FOREIGN KEYS DETECTADAS ===' as info;

SELECT
    tc.table_name as tabla_hija,
    kcu.column_name as columna_fk,
    ccu.table_name as tabla_padre,
    ccu.column_name as columna_padre,
    rc.delete_rule,
    tc.constraint_name
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
-- PARTE 3: CONTAR REGISTROS EN CADA TABLA AUTOMÁTICAMENTE
-- ============================================================================

SELECT '=== PASO 3: CONTEO DE REGISTROS POR TABLA ===' as info;

DO $$
DECLARE
    r RECORD;
    sql_query TEXT;
    count_result BIGINT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '%-30s | %s', 'TABLA', 'TOTAL REGISTROS';
    RAISE NOTICE '%', repeat('-', 50);

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        sql_query := format('SELECT COUNT(*) FROM public.%I', r.tablename);
        EXECUTE sql_query INTO count_result;
        RAISE NOTICE '%-30s | %', r.tablename, count_result;
    END LOOP;

    RAISE NOTICE '%', repeat('-', 50);
END $$;

-- ============================================================================
-- PARTE 4: DETECTAR HUÉRFANOS AUTOMÁTICAMENTE
-- ============================================================================

SELECT '=== PASO 4: ANÁLISIS DE DATOS HUÉRFANOS ===' as info;

-- Esta función encuentra huérfanos para CADA foreign key detectada
DO $$
DECLARE
    fk_record RECORD;
    sql_query TEXT;
    orphan_count BIGINT;
    total_checked INTEGER := 0;
    total_orphans_found INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '%-30s | %-20s | %-20s | %s',
        'TABLA HIJA', 'COLUMNA FK', 'TABLA PADRE', 'HUÉRFANOS';
    RAISE NOTICE '%', repeat('=', 100);

    -- Iterar sobre todas las foreign keys
    FOR fk_record IN
        SELECT
            tc.table_name as child_table,
            kcu.column_name as fk_column,
            ccu.table_name as parent_table,
            ccu.column_name as parent_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        ORDER BY tc.table_name
    LOOP
        -- Construir query dinámicamente para contar huérfanos
        sql_query := format(
            'SELECT COUNT(*) FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM public.%I)',
            fk_record.child_table,
            fk_record.fk_column,
            fk_record.fk_column,
            fk_record.parent_column,
            fk_record.parent_table
        );

        -- Ejecutar y contar
        EXECUTE sql_query INTO orphan_count;

        total_checked := total_checked + 1;

        IF orphan_count > 0 THEN
            total_orphans_found := total_orphans_found + 1;
            RAISE NOTICE '%-30s | %-20s | %-20s | % ❌ HUÉRFANOS',
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.parent_table,
                orphan_count;
        ELSE
            RAISE NOTICE '%-30s | %-20s | %-20s | ✅ OK',
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.parent_table;
        END IF;
    END LOOP;

    RAISE NOTICE '%', repeat('=', 100);
    RAISE NOTICE '';
    RAISE NOTICE 'Total de relaciones verificadas: %', total_checked;
    RAISE NOTICE 'Relaciones con huérfanos: %', total_orphans_found;

    IF total_orphans_found = 0 THEN
        RAISE NOTICE '🎉 ¡NO HAY DATOS HUÉRFANOS EN LA BASE DE DATOS!';
    ELSE
        RAISE NOTICE '⚠️  Se encontraron % relaciones con datos huérfanos', total_orphans_found;
    END IF;
END $$;

-- ============================================================================
-- PARTE 5: MOSTRAR EJEMPLOS DE REGISTROS HUÉRFANOS (si existen)
-- ============================================================================

SELECT '=== PASO 5: EJEMPLOS DE REGISTROS HUÉRFANOS ===' as info;

DO $$
DECLARE
    fk_record RECORD;
    sql_query TEXT;
    orphan_count BIGINT;
    result_record RECORD;
    has_orphans BOOLEAN := false;
BEGIN
    -- Buscar foreign keys con huérfanos y mostrar ejemplos
    FOR fk_record IN
        SELECT
            tc.table_name as child_table,
            kcu.column_name as fk_column,
            ccu.table_name as parent_table,
            ccu.column_name as parent_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        -- Verificar si hay huérfanos
        sql_query := format(
            'SELECT COUNT(*) FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM public.%I)',
            fk_record.child_table,
            fk_record.fk_column,
            fk_record.fk_column,
            fk_record.parent_column,
            fk_record.parent_table
        );

        EXECUTE sql_query INTO orphan_count;

        -- Si hay huérfanos, mostrar primeros 5 ejemplos
        IF orphan_count > 0 THEN
            has_orphans := true;

            RAISE NOTICE '';
            RAISE NOTICE '❌ HUÉRFANOS EN: %.% (apunta a %.%)',
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.parent_table,
                fk_record.parent_column;
            RAISE NOTICE 'Total: % registros huérfanos', orphan_count;
            RAISE NOTICE 'Primeros 5 ejemplos:';

            -- Construir query para mostrar ejemplos
            sql_query := format(
                'SELECT id, %I as fk_value FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM public.%I) LIMIT 5',
                fk_record.fk_column,
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.fk_column,
                fk_record.parent_column,
                fk_record.parent_table
            );

            FOR result_record IN EXECUTE sql_query LOOP
                RAISE NOTICE '  - ID: %, FK apunta a: %', result_record.id, result_record.fk_value;
            END LOOP;
        END IF;
    END LOOP;

    IF NOT has_orphans THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ No se encontraron registros huérfanos';
    END IF;
END $$;

-- ============================================================================
-- RESUMEN FINAL
-- ============================================================================

SELECT '=== RESUMEN FINAL ===' as info;

SELECT
    '✅ Análisis automático completado' as status,
    'Revisa los NOTICE en la consola para ver detalles completos' as nota,
    'Si hay huérfanos, usa el script 30_cleanup_orphaned_records.sql' as siguiente_paso;
