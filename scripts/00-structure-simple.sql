-- =====================================================
-- Script SIMPLE: Ver estructura completa en un solo resultado
-- Copia TODO el output y pégalo aquí para generar el script de reset
-- =====================================================

WITH
-- Todas las tablas
tables_list AS (
    SELECT
        2 as orden,
        tablename as suborden,
        '  - ' || tablename as linea
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
),

-- Todos los foreign keys
fk_list AS (
    SELECT
        5 as orden,
        tc.table_name || '.' || kcu.column_name as suborden,
        '  - ' || tc.table_name || '.' || kcu.column_name ||
        ' → ' || ccu.table_name || '.' || ccu.column_name ||
        ' [DELETE: ' || rc.delete_rule || ']' as linea
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
),

-- Contadores
counters AS (
    SELECT
        (SELECT COUNT(*)::text FROM pg_catalog.pg_tables WHERE schemaname = 'public') as total_tables,
        (SELECT COUNT(*)::text FROM information_schema.table_constraints
         WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY') as total_fks
),

structure_data AS (
    SELECT 1 as orden, '' as suborden, '📋 TABLAS:' as linea

    UNION ALL
    SELECT orden, suborden, linea FROM tables_list

    UNION ALL
    SELECT 3, '', ''

    UNION ALL
    SELECT 4, '', '🔗 FOREIGN KEYS (dependencias):'

    UNION ALL
    SELECT orden, suborden, linea FROM fk_list

    UNION ALL
    SELECT 6, '', ''

    UNION ALL
    SELECT 7, '', '📊 RESUMEN:'

    UNION ALL
    SELECT 8, '', '  Total tablas: ' || total_tables FROM counters

    UNION ALL
    SELECT 9, '', '  Total FKs: ' || total_fks FROM counters
)

SELECT linea as "ESTRUCTURA_BASE_DE_DATOS"
FROM structure_data
ORDER BY orden, suborden;
