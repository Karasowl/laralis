-- =====================================================
-- Script: Obtener estructura COMPLETA en un solo resultado
-- Propósito: Mostrar toda la info necesaria para crear script de reset
-- Output: Un solo SELECT con toda la estructura en formato texto
-- =====================================================

WITH
-- 1. Todas las tablas del esquema public
all_tables AS (
    SELECT tablename as table_name
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
),

-- 2. Foreign Keys con reglas de CASCADE
foreign_keys AS (
    SELECT
        tc.table_name as child_table,
        kcu.column_name as fk_column,
        ccu.table_name as parent_table,
        ccu.column_name as parent_column,
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
    ORDER BY tc.table_name, kcu.column_name
),

-- 3. Conteo de columnas por tabla
column_counts AS (
    SELECT
        table_name,
        COUNT(*) as num_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
)

-- RESULTADO FINAL: Todo en un solo SELECT
SELECT
    '=== ESTRUCTURA COMPLETA DE LA BASE DE DATOS ===' as info,
    '' as blank1,
    '📊 TABLAS ENCONTRADAS:' as seccion1,
    (SELECT string_agg(table_name || ' (' || COALESCE(cc.num_columns::text, '0') || ' cols)', ', ' ORDER BY table_name)
     FROM all_tables at
     LEFT JOIN column_counts cc ON at.table_name = cc.table_name) as tablas,
    '' as blank2,
    '🔗 FOREIGN KEYS (orden de dependencia):' as seccion2,
    (SELECT string_agg(
        child_table || '.' || fk_column || ' -> ' ||
        parent_table || '.' || parent_column ||
        ' [ON DELETE ' || delete_rule || ']',
        E'\n' ORDER BY child_table, fk_column)
     FROM foreign_keys) as foreign_keys,
    '' as blank3,
    '📈 RESUMEN:' as seccion3,
    (SELECT COUNT(*)::text FROM all_tables) || ' tablas totales' as total_tablas,
    (SELECT COUNT(*)::text FROM foreign_keys) || ' foreign keys' as total_fks,
    (SELECT COUNT(*)::text FROM information_schema.columns WHERE table_schema = 'public') || ' columnas totales' as total_cols

UNION ALL

-- Lista detallada de cada tabla con sus FKs
SELECT
    '=== DETALLE POR TABLA ===' as info,
    '' as blank1,
    table_name as tabla,
    '' as blank2,
    'FKs que dependen DE esta tabla:' as tipo1,
    (SELECT string_agg(child_table || ' (' || fk_column || ')', ', ')
     FROM foreign_keys fk
     WHERE fk.parent_table = at.table_name) as dependientes,
    'FKs que esta tabla tiene HACIA otras:' as tipo2,
    (SELECT string_agg(parent_table || ' (' || fk_column || ')', ', ')
     FROM foreign_keys fk
     WHERE fk.child_table = at.table_name) as referencias,
    '' as blank3,
    '' as blank4,
    '' as blank5,
    '' as blank6
FROM all_tables at
ORDER BY table_name;
