-- ============================================================================
-- ANÁLISIS DE DATOS HUÉRFANOS - VERSIÓN FINAL
-- Basado en la estructura REAL de la base de datos
-- Este script detecta automáticamente huérfanos usando las FK existentes
-- Fecha: 2025-10-16
-- ============================================================================

-- ============================================================================
-- PARTE 1: ANÁLISIS AUTOMÁTICO DE FOREIGN KEYS
-- ============================================================================

DO $$
DECLARE
    fk_record RECORD;
    sql_query TEXT;
    orphan_count BIGINT;
    total_checked INTEGER := 0;
    total_orphans_found INTEGER := 0;
    has_orphans BOOLEAN := false;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  ANÁLISIS AUTOMÁTICO DE DATOS HUÉRFANOS                                    ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '%-35s | %-20s | %-20s | %s',
        'TABLA HIJA', 'COLUMNA FK', 'TABLA PADRE', 'RESULTADO';
    RAISE NOTICE '%', repeat('═', 110);

    -- Iterar sobre todas las foreign keys detectadas
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
        -- Construir query dinámicamente para contar huérfanos
        -- Considerando que la tabla padre puede estar en otro schema (como auth.users)
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
            -- Para tablas en otros schemas (como auth.users)
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

        -- Ejecutar y contar
        EXECUTE sql_query INTO orphan_count;
        total_checked := total_checked + 1;

        IF orphan_count > 0 THEN
            total_orphans_found := total_orphans_found + 1;
            has_orphans := true;
            RAISE NOTICE '%-35s | %-20s | %-20s | % ❌ HUÉRFANOS',
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.parent_table || '.' || fk_record.parent_column,
                orphan_count;
        ELSE
            RAISE NOTICE '%-35s | %-20s | %-20s | ✅ OK',
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.parent_table || '.' || fk_record.parent_column;
        END IF;
    END LOOP;

    RAISE NOTICE '%', repeat('═', 110);
    RAISE NOTICE '';
    RAISE NOTICE 'Total de relaciones verificadas: %', total_checked;
    RAISE NOTICE 'Relaciones con huérfanos: %', total_orphans_found;
    RAISE NOTICE '';

    IF total_orphans_found = 0 THEN
        RAISE NOTICE '🎉 ¡EXCELENTE! NO HAY DATOS HUÉRFANOS EN LA BASE DE DATOS';
    ELSE
        RAISE NOTICE '⚠️  ATENCIÓN: Se encontraron % relaciones con datos huérfanos', total_orphans_found;
        RAISE NOTICE '📋 Continúa leyendo para ver ejemplos específicos...';
    END IF;

    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PARTE 2: VERIFICACIÓN ESPECIAL - treatments.clinic_id
-- (NO tiene FK constraint, necesita verificación manual)
-- ============================================================================

DO $$
DECLARE
    orphan_count BIGINT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  VERIFICACIÓN ESPECIAL: treatments.clinic_id (SIN FK CONSTRAINT)           ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';

    -- Verificar treatments.clinic_id
    SELECT COUNT(*) INTO orphan_count
    FROM public.treatments
    WHERE clinic_id IS NOT NULL
      AND clinic_id NOT IN (SELECT id FROM public.clinics);

    IF orphan_count > 0 THEN
        RAISE NOTICE '❌ treatments.clinic_id tiene % registros huérfanos', orphan_count;
        RAISE NOTICE '   (Esta columna NO tiene Foreign Key constraint definido)';
    ELSE
        RAISE NOTICE '✅ treatments.clinic_id: OK (0 huérfanos)';
    END IF;

    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PARTE 3: MOSTRAR EJEMPLOS DE REGISTROS HUÉRFANOS
-- ============================================================================

DO $$
DECLARE
    fk_record RECORD;
    sql_query TEXT;
    orphan_count BIGINT;
    result_record RECORD;
    example_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  EJEMPLOS DE REGISTROS HUÉRFANOS (Primeros 5 de cada tipo)                ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';

    -- Buscar foreign keys con huérfanos y mostrar ejemplos
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
    LOOP
        -- Verificar si hay huérfanos
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

        -- Si hay huérfanos, mostrar ejemplos
        IF orphan_count > 0 THEN
            example_count := example_count + 1;

            RAISE NOTICE '';
            RAISE NOTICE '─────────────────────────────────────────────────────────────────────────────';
            RAISE NOTICE '❌ HUÉRFANO #%: %.% → %.%',
                example_count,
                fk_record.child_table,
                fk_record.fk_column,
                fk_record.parent_table,
                fk_record.parent_column;
            RAISE NOTICE '   Total: % registros huérfanos', orphan_count;
            RAISE NOTICE '   Primeros 5 ejemplos:';

            -- Construir query para mostrar ejemplos
            IF fk_record.parent_schema = 'public' THEN
                sql_query := format(
                    'SELECT id, %I as fk_value FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM public.%I) LIMIT 5',
                    fk_record.fk_column,
                    fk_record.child_table,
                    fk_record.fk_column,
                    fk_record.fk_column,
                    fk_record.parent_column,
                    fk_record.parent_table
                );
            ELSE
                sql_query := format(
                    'SELECT id, %I as fk_value FROM public.%I WHERE %I IS NOT NULL AND %I NOT IN (SELECT %I FROM %I.%I) LIMIT 5',
                    fk_record.fk_column,
                    fk_record.child_table,
                    fk_record.fk_column,
                    fk_record.fk_column,
                    fk_record.parent_column,
                    fk_record.parent_schema,
                    fk_record.parent_table
                );
            END IF;

            FOR result_record IN EXECUTE sql_query LOOP
                RAISE NOTICE '      • ID: %', result_record.id;
                RAISE NOTICE '        FK apunta a (inexistente): %', result_record.fk_value;
            END LOOP;
        END IF;
    END LOOP;

    -- Verificación especial para treatments.clinic_id
    SELECT COUNT(*) INTO orphan_count
    FROM public.treatments
    WHERE clinic_id IS NOT NULL
      AND clinic_id NOT IN (SELECT id FROM public.clinics);

    IF orphan_count > 0 THEN
        example_count := example_count + 1;

        RAISE NOTICE '';
        RAISE NOTICE '─────────────────────────────────────────────────────────────────────────────';
        RAISE NOTICE '❌ HUÉRFANO #%: treatments.clinic_id → clinics.id (SIN FK)',
            example_count;
        RAISE NOTICE '   Total: % registros huérfanos', orphan_count;
        RAISE NOTICE '   Primeros 5 ejemplos:';

        FOR result_record IN
            SELECT id, clinic_id
            FROM public.treatments
            WHERE clinic_id IS NOT NULL
              AND clinic_id NOT IN (SELECT id FROM public.clinics)
            LIMIT 5
        LOOP
            RAISE NOTICE '      • ID: %', result_record.id;
            RAISE NOTICE '        clinic_id apunta a (inexistente): %', result_record.clinic_id;
        END LOOP;
    END IF;

    IF example_count = 0 THEN
        RAISE NOTICE '✅ No se encontraron registros huérfanos';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '─────────────────────────────────────────────────────────────────────────────';
END $$;

-- ============================================================================
-- PARTE 4: RESUMEN FINAL Y PRÓXIMOS PASOS
-- ============================================================================

SELECT
    '✅ Análisis completado' as "Estado",
    'Revisa los mensajes NOTICE arriba para ver detalles' as "Nota",
    CASE
        WHEN EXISTS (
            -- Verificar si hay huérfanos en alguna FK
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
            LIMIT 1
        )
        THEN 'Si hay huérfanos, usa 30_cleanup_orphaned_records.sql para eliminarlos'
        ELSE 'Base de datos limpia, no se requiere acción'
    END as "Próximo Paso";
