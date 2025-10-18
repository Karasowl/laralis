-- ============================================================================
-- ANÁLISIS DE DATOS HUÉRFANOS - RESULTADOS EN TABLAS
-- Este script devuelve TODO en tablas SELECT visibles en Supabase
-- NO usa RAISE NOTICE, TODO es visible en la UI
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear tabla temporal para almacenar resultados
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS orphan_analysis (
    step_number INTEGER,
    step_name TEXT,
    table_name TEXT,
    column_name TEXT,
    parent_table TEXT,
    parent_column TEXT,
    orphan_count BIGINT,
    status TEXT,
    example_ids TEXT[]
);

-- ============================================================================
-- PASO 2: Analizar TODAS las Foreign Keys automáticamente
-- ============================================================================

DO $$
DECLARE
    fk_record RECORD;
    sql_query TEXT;
    orphan_count BIGINT;
    example_ids TEXT[];
    step_num INTEGER := 1;
BEGIN
    -- Limpiar tabla temporal
    DELETE FROM orphan_analysis;

    -- Iterar sobre todas las foreign keys
    FOR fk_record IN
        SELECT
            tc.table_name as child_table,
            kcu.column_name as fk_column,
            ccu.table_name as parent_table,
            ccu.column_name as parent_column,
            ccu.table_schema as parent_schema
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
    LOOP
        -- Construir query para contar huérfanos
        IF fk_record.parent_schema = 'public' THEN
            sql_query := format(
                'SELECT COUNT(*) FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM public.%I)',
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.fk_column,
                fk_record.parent_column,
                fk_record.parent_table
            );
        ELSE
            sql_query := format(
                'SELECT COUNT(*) FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM %I.%I)',
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.fk_column,
                fk_record.parent_column,
                fk_record.parent_schema,
                fk_record.parent_table
            );
        END IF;

        EXECUTE sql_query INTO orphan_count;

        -- Si hay huérfanos, obtener ejemplos de IDs
        IF orphan_count > 0 THEN
            IF fk_record.parent_schema = 'public' THEN
                sql_query := format(
                    'SELECT ARRAY_AGG(id::text) FROM (SELECT id FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM public.%I) LIMIT 5) sub',
                    fk_record.child_table,
                    fk_record.fk_column,
                    fk_record.fk_column,
                    fk_record.parent_column,
                    fk_record.parent_table
                );
            ELSE
                sql_query := format(
                    'SELECT ARRAY_AGG(id::text) FROM (SELECT id FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM %I.%I) LIMIT 5) sub',
                    fk_record.child_table,
                    fk_record.fk_column,
                    fk_record.fk_column,
                    fk_record.parent_column,
                    fk_record.parent_schema,
                    fk_record.parent_table
                );
            END IF;

            EXECUTE sql_query INTO example_ids;
        ELSE
            example_ids := NULL;
        END IF;

        -- Insertar resultado
        INSERT INTO orphan_analysis VALUES (
            step_num,
            'Foreign Key Analysis',
            fk_record.child_table,
            fk_record.fk_column,
            fk_record.parent_table,
            fk_record.parent_column,
            orphan_count,
            CASE WHEN orphan_count = 0 THEN '✅ OK' ELSE '❌ HUÉRFANOS' END,
            example_ids
        );

        step_num := step_num + 1;
    END LOOP;

    -- Verificación especial: treatments.clinic_id (sin FK)
    SELECT COUNT(*) INTO orphan_count
    FROM public.treatments
    WHERE clinic_id IS NOT NULL
      AND clinic_id NOT IN (SELECT id FROM public.clinics);

    IF orphan_count > 0 THEN
        SELECT ARRAY_AGG(id::text) INTO example_ids
        FROM (
            SELECT id FROM public.treatments
            WHERE clinic_id IS NOT NULL
              AND clinic_id NOT IN (SELECT id FROM public.clinics)
            LIMIT 5
        ) sub;
    ELSE
        example_ids := NULL;
    END IF;

    INSERT INTO orphan_analysis VALUES (
        step_num,
        'Special Check (No FK)',
        'treatments',
        'clinic_id',
        'clinics',
        'id',
        orphan_count,
        CASE WHEN orphan_count = 0 THEN '✅ OK' ELSE '❌ HUÉRFANOS (SIN FK)' END,
        example_ids
    );
END $$;

-- ============================================================================
-- RESULTADO 1: Resumen General
-- ============================================================================

SELECT
    '📊 RESUMEN GENERAL' as "Sección";

SELECT
    COUNT(*) as "Total Relaciones Verificadas",
    SUM(CASE WHEN orphan_count > 0 THEN 1 ELSE 0 END) as "Relaciones con Huérfanos",
    SUM(orphan_count) as "Total Registros Huérfanos",
    CASE
        WHEN SUM(orphan_count) = 0 THEN '🎉 Base de datos LIMPIA'
        ELSE '⚠️  Requiere limpieza'
    END as "Estado"
FROM orphan_analysis;

-- ============================================================================
-- RESULTADO 2: Detalle de TODAS las Foreign Keys
-- ============================================================================

SELECT
    '📋 DETALLE DE FOREIGN KEYS' as "Sección";

SELECT
    row_number() OVER (ORDER BY orphan_count DESC, table_name) as "#",
    table_name as "Tabla Hija",
    column_name as "Columna FK",
    parent_table || '.' || parent_column as "Tabla Padre",
    orphan_count as "Huérfanos",
    status as "Estado"
FROM orphan_analysis
ORDER BY orphan_count DESC, table_name, column_name;

-- ============================================================================
-- RESULTADO 3: SOLO las que tienen HUÉRFANOS (si existen)
-- ============================================================================

SELECT
    '❌ RELACIONES CON HUÉRFANOS' as "Sección";

SELECT
    row_number() OVER (ORDER BY orphan_count DESC) as "#",
    table_name as "Tabla",
    column_name as "Columna",
    parent_table || '.' || parent_column as "Apunta a",
    orphan_count as "Total Huérfanos",
    status as "Estado",
    array_length(example_ids, 1) as "Ejemplos (IDs)",
    array_to_string(example_ids, ', ') as "IDs de Ejemplo"
FROM orphan_analysis
WHERE orphan_count > 0
ORDER BY orphan_count DESC;

-- ============================================================================
-- RESULTADO 4: Conteo por Tabla
-- ============================================================================

SELECT
    '📊 HUÉRFANOS POR TABLA' as "Sección";

SELECT
    table_name as "Tabla",
    COUNT(*) as "FKs Verificadas",
    SUM(orphan_count) as "Total Huérfanos",
    STRING_AGG(
        CASE WHEN orphan_count > 0
        THEN column_name || ' (' || orphan_count || ')'
        ELSE NULL END,
        ', '
    ) as "Columnas con Huérfanos"
FROM orphan_analysis
GROUP BY table_name
HAVING SUM(orphan_count) > 0
ORDER BY SUM(orphan_count) DESC;

-- ============================================================================
-- RESULTADO 5: Recomendaciones
-- ============================================================================

SELECT
    '💡 PRÓXIMOS PASOS' as "Sección";

SELECT
    CASE
        WHEN (SELECT SUM(orphan_count) FROM orphan_analysis) = 0 THEN
            '✅ No se requiere acción. Tu base de datos está limpia.'
        ELSE
            '⚠️  Ejecuta el script 30_cleanup_orphaned_records.sql para eliminar ' ||
            (SELECT SUM(orphan_count) FROM orphan_analysis) ||
            ' registros huérfanos.'
    END as "Recomendación",
    (SELECT COUNT(*) FROM orphan_analysis WHERE orphan_count > 0) as "Relaciones Afectadas",
    (SELECT SUM(orphan_count) FROM orphan_analysis) as "Total Registros a Limpiar";

-- ============================================================================
-- LIMPIAR TABLA TEMPORAL
-- ============================================================================

DROP TABLE IF EXISTS orphan_analysis;
