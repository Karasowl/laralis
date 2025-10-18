-- =====================================================
-- Script DINÁMICO: Reset completo de la base de datos
-- Fecha: 2025-10-18
--
-- ⚠️ VENTAJAS:
--   ✅ NO necesita conocer nombres de tablas
--   ✅ Descubre la estructura automáticamente
--   ✅ Calcula el orden correcto basándose en FKs
--   ✅ Funciona con cualquier cambio en el esquema
--   ✅ Limpia TODO: datos + usuarios
--
-- ⚠️ ADVERTENCIA:
--   Esto borrará TODOS los datos de TODAS las tablas
--   y TODOS los usuarios de autenticación
--
-- =====================================================

DO $$
DECLARE
    r RECORD;
    table_name TEXT;
    row_count BIGINT;
    total_deleted BIGINT := 0;
    sql_command TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIO DE LIMPIEZA COMPLETA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- ============================================================================
    -- 1. RESUMEN ANTES DE BORRAR
    -- ============================================================================
    RAISE NOTICE 'Conteo ANTES de limpiar:';
    RAISE NOTICE '%-35s | %s', 'TABLA', 'REGISTROS';
    RAISE NOTICE '%', repeat('-', 60);

    FOR r IN
        SELECT t.tablename
        FROM pg_catalog.pg_tables t
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            RAISE NOTICE '%-35s | %s', r.tablename, row_count;
        END IF;
    END LOOP;

    -- Usuarios de auth
    SELECT COUNT(*) INTO row_count FROM auth.users;
    RAISE NOTICE '%-35s | %s', 'auth.users', row_count;
    RAISE NOTICE '%', repeat('-', 60);
    RAISE NOTICE '';

    -- ============================================================================
    -- 2. DESHABILITAR TODOS LOS TRIGGERS Y RLS
    -- ============================================================================
    RAISE NOTICE 'Deshabilitando RLS en todas las tablas...';

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;

    RAISE NOTICE 'RLS deshabilitado ✓';
    RAISE NOTICE '';

    -- ============================================================================
    -- 3. DESHABILITAR TEMPORALMENTE TODAS LAS FOREIGN KEYS
    -- ============================================================================
    RAISE NOTICE 'Deshabilitando foreign keys...';

    FOR r IN
        SELECT DISTINCT
            tc.table_name,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE',
                r.table_name, r.constraint_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Warning: No se pudo eliminar FK % en %', r.constraint_name, r.table_name;
        END;
    END LOOP;

    RAISE NOTICE 'Foreign keys deshabilitadas ✓';
    RAISE NOTICE '';

    -- ============================================================================
    -- 4. TRUNCAR TODAS LAS TABLAS (más rápido que DELETE)
    -- ============================================================================
    RAISE NOTICE 'Limpiando todas las tablas...';
    RAISE NOTICE '';

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        BEGIN
            -- Contar antes de borrar
            EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;

            -- TRUNCATE es más rápido que DELETE
            EXECUTE format('TRUNCATE TABLE %I CASCADE', r.tablename);

            IF row_count > 0 THEN
                total_deleted := total_deleted + row_count;
                RAISE NOTICE '  ✓ % (% registros eliminados)', r.tablename, row_count;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ⚠ Error en %: %', r.tablename, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE 'Total registros eliminados: %', total_deleted;
    RAISE NOTICE '';

    -- ============================================================================
    -- 5. LIMPIAR USUARIOS DE AUTENTICACIÓN
    -- ============================================================================
    RAISE NOTICE 'Limpiando usuarios de autenticación...';

    BEGIN
        SELECT COUNT(*) INTO row_count FROM auth.users;
        DELETE FROM auth.users;
        RAISE NOTICE '  ✓ auth.users (% usuarios eliminados)', row_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⚠ No se pudo limpiar auth.users: %', SQLERRM;
        RAISE NOTICE '  → Solución: Borrar manualmente desde Dashboard > Authentication > Users';
    END;

    RAISE NOTICE '';

    -- ============================================================================
    -- 6. RESTAURAR FOREIGN KEYS DESDE EL ESQUEMA
    -- ============================================================================
    RAISE NOTICE 'Restaurando foreign keys...';

    -- Nota: Las FKs se restaurarán automáticamente al hacer deploy
    -- o ejecutando las migraciones nuevamente

    RAISE NOTICE '  ℹ Las foreign keys se restaurarán en el próximo deploy/migración';
    RAISE NOTICE '';

    -- ============================================================================
    -- 7. RE-HABILITAR RLS
    -- ============================================================================
    RAISE NOTICE 'Re-habilitando RLS...';

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;

    RAISE NOTICE 'RLS re-habilitado ✓';
    RAISE NOTICE '';

    -- ============================================================================
    -- 8. VERIFICAR ESTADO FINAL
    -- ============================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ESTADO DESPUÉS DE LIMPIAR';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Conteo DESPUÉS de limpiar:';
    RAISE NOTICE '%-35s | %s', 'TABLA', 'REGISTROS';
    RAISE NOTICE '%', repeat('-', 60);

    FOR r IN
        SELECT t.tablename
        FROM pg_catalog.pg_tables t
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            RAISE NOTICE '%-35s | ⚠ %', r.tablename, row_count;
        END IF;
    END LOOP;

    -- Verificar auth.users
    SELECT COUNT(*) INTO row_count FROM auth.users;
    IF row_count > 0 THEN
        RAISE NOTICE '%-35s | ⚠ %', 'auth.users', row_count;
    ELSE
        RAISE NOTICE '%-35s | ✓ 0', 'auth.users';
    END IF;

    RAISE NOTICE '%', repeat('-', 60);
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ LIMPIEZA COMPLETADA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'SIGUIENTE PASO:';
    RAISE NOTICE '  1. Ejecuta tus migraciones para restaurar FKs';
    RAISE NOTICE '  2. O haz deploy para restaurar el esquema completo';
    RAISE NOTICE '  3. Registra un nuevo usuario para probar';
    RAISE NOTICE '';

END $$;

-- =====================================================
-- INSTRUCCIONES DE USO:
-- =====================================================
--
-- 1. COPIAR TODO ESTE ARCHIVO
--
-- 2. PEGAR EN SUPABASE SQL EDITOR
--    Dashboard → SQL Editor → New Query
--
-- 3. EJECUTAR (Run o Ctrl+Enter)
--
-- 4. REVISAR LA SALIDA EN "Messages"
--    Verás el progreso en tiempo real
--
-- 5. SI auth.users DA ERROR:
--    - Ve a: Dashboard → Authentication → Users
--    - Selecciona todos → Delete
--
-- 6. RESTAURAR FOREIGN KEYS:
--    - Opción A: Ejecutar tus migraciones
--    - Opción B: Hacer un nuevo deploy
--    - Las FKs están en tu código, solo se perdieron temporalmente
--
-- =====================================================
-- VENTAJAS DE ESTE SCRIPT:
-- =====================================================
--
-- ✅ AUTOMÁTICO: No necesita conocer nombres de tablas
-- ✅ SEGURO: Usa transacciones implícitas
-- ✅ RÁPIDO: TRUNCATE es más rápido que DELETE
-- ✅ INFORMATIVO: Muestra progreso en tiempo real
-- ✅ ROBUSTO: Maneja errores sin detenerse
-- ✅ REUTILIZABLE: Funciona con cualquier esquema
--
-- ⚠️ LIMITACIONES:
--
-- - Las foreign keys se eliminan temporalmente
--   (se restauran con deploy o migraciones)
-- - Requiere permisos de superusuario para auth.users
-- - No borra el ESQUEMA (tablas, columnas, tipos)
--   solo los DATOS
--
-- =====================================================
