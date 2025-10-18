-- =====================================================
-- Script SIMPLE y RÁPIDO: Limpia TODO sin tocar FKs
-- Fecha: 2025-10-18
--
-- ⚠️ VENTAJAS:
--   ✅ NO toca foreign keys (se mantienen intactas)
--   ✅ Muy rápido (usa TRUNCATE CASCADE)
--   ✅ Automático (descubre tablas dinámicamente)
--   ✅ Limpia TODO: datos + usuarios
--   ✅ NO requiere restaurar nada después
--
-- ⚠️ ADVERTENCIA:
--   Borrará TODOS los datos pero preservará el esquema completo
--
-- =====================================================

DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    total_deleted BIGINT := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'LIMPIEZA COMPLETA DE DATOS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- ============================================================================
    -- 1. RESUMEN ANTES DE BORRAR
    -- ============================================================================
    RAISE NOTICE 'Conteo ANTES de limpiar:';
    RAISE NOTICE '%-40s | %s', 'TABLA', 'REGISTROS';
    RAISE NOTICE '%', repeat('-', 65);

    FOR r IN
        SELECT t.tablename
        FROM pg_catalog.pg_tables t
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            RAISE NOTICE '%-40s | %s', r.tablename, row_count;
            total_deleted := total_deleted + row_count;
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO row_count FROM auth.users;
    RAISE NOTICE '%-40s | %s', 'auth.users', row_count;
    total_deleted := total_deleted + row_count;

    RAISE NOTICE '%', repeat('-', 65);
    RAISE NOTICE 'TOTAL DE REGISTROS: %', total_deleted;
    RAISE NOTICE '';

    -- ============================================================================
    -- 2. DESHABILITAR RLS TEMPORALMENTE
    -- ============================================================================
    RAISE NOTICE 'Deshabilitando RLS en todas las tablas...';

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;

    RAISE NOTICE '  ✓ RLS deshabilitado';
    RAISE NOTICE '';

    -- ============================================================================
    -- 3. TRUNCAR TODAS LAS TABLAS CON CASCADE
    -- ============================================================================
    RAISE NOTICE 'Limpiando todas las tablas (TRUNCATE CASCADE)...';
    RAISE NOTICE '';

    -- TRUNCATE CASCADE: Limpia automáticamente las tablas dependientes
    -- Sin necesidad de eliminar foreign keys
    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;

            IF row_count > 0 THEN
                -- RESTART IDENTITY: Reinicia secuencias (IDs)
                -- CASCADE: Limpia tablas que dependan de esta
                EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename);
                RAISE NOTICE '  ✓ %-35s (% registros)', r.tablename, row_count;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Si ya fue limpiada por CASCADE de otra tabla, ignorar
            RAISE NOTICE '  ℹ %-35s (ya limpiada por CASCADE)', r.tablename;
        END;
    END LOOP;

    RAISE NOTICE '';

    -- ============================================================================
    -- 4. LIMPIAR USUARIOS DE AUTENTICACIÓN
    -- ============================================================================
    RAISE NOTICE 'Limpiando usuarios de autenticación...';

    BEGIN
        SELECT COUNT(*) INTO row_count FROM auth.users;
        DELETE FROM auth.users;
        RAISE NOTICE '  ✓ auth.users (% usuarios eliminados)', row_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⚠ Error limpiando auth.users: %', SQLERRM;
        RAISE NOTICE '  → Solución: Borrar manualmente desde Dashboard > Authentication > Users';
    END;

    RAISE NOTICE '';

    -- ============================================================================
    -- 5. RE-HABILITAR RLS
    -- ============================================================================
    RAISE NOTICE 'Re-habilitando RLS...';

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;

    RAISE NOTICE '  ✓ RLS re-habilitado';
    RAISE NOTICE '';

    -- ============================================================================
    -- 6. VERIFICAR ESTADO FINAL
    -- ============================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ESTADO DESPUÉS DE LIMPIAR';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    total_deleted := 0;

    FOR r IN
        SELECT t.tablename
        FROM pg_catalog.pg_tables t
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            RAISE NOTICE '  ⚠ %-35s tiene % registros', r.tablename, row_count;
        END IF;
        total_deleted := total_deleted + row_count;
    END LOOP;

    SELECT COUNT(*) INTO row_count FROM auth.users;
    IF row_count > 0 THEN
        RAISE NOTICE '  ⚠ auth.users tiene % usuarios', row_count;
    END IF;
    total_deleted := total_deleted + row_count;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';

    IF total_deleted = 0 THEN
        RAISE NOTICE '✅ LIMPIEZA COMPLETADA EXITOSAMENTE';
        RAISE NOTICE '   Todas las tablas están vacías';
    ELSE
        RAISE NOTICE '⚠ LIMPIEZA PARCIAL';
        RAISE NOTICE '   Quedan % registros sin limpiar', total_deleted;
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'ESTRUCTURA PRESERVADA:';
    RAISE NOTICE '  ✓ Tablas y columnas';
    RAISE NOTICE '  ✓ Foreign keys';
    RAISE NOTICE '  ✓ Índices';
    RAISE NOTICE '  ✓ Triggers y funciones';
    RAISE NOTICE '  ✓ Vistas';
    RAISE NOTICE '  ✓ Políticas RLS';
    RAISE NOTICE '';
    RAISE NOTICE 'SIGUIENTE PASO:';
    RAISE NOTICE '  → Registrar nuevo usuario en /auth/register';
    RAISE NOTICE '  → Completar onboarding (workspace + clínica)';
    RAISE NOTICE '';

END $$;

-- =====================================================
-- INSTRUCCIONES DE USO:
-- =====================================================
--
-- 1. Copiar TODO este archivo
-- 2. Pegar en Supabase SQL Editor
-- 3. Ejecutar (Run o Ctrl+Enter)
-- 4. Ver progreso en pestaña "Messages"
-- 5. ¡Listo! No necesitas restaurar nada
--
-- =====================================================
-- POR QUÉ ESTE SCRIPT ES MEJOR:
-- =====================================================
--
-- ✅ NO elimina foreign keys (se preservan 100%)
-- ✅ Usa TRUNCATE CASCADE (PostgreSQL se encarga del orden)
-- ✅ RESTART IDENTITY reinicia auto-incrementos
-- ✅ Más rápido que DELETE
-- ✅ No requiere conocer nombres de tablas
-- ✅ No necesitas ejecutar nada después (deploy, migraciones, etc.)
-- ✅ Funciona con cualquier esquema
--
-- =====================================================
-- CÓMO FUNCIONA TRUNCATE CASCADE:
-- =====================================================
--
-- Cuando haces:
--   TRUNCATE TABLE clinics CASCADE
--
-- PostgreSQL automáticamente limpia:
--   - patients (tiene FK a clinics)
--   - treatments (tiene FK a patients)
--   - expenses (tiene FK a clinics)
--   - ... todas las dependientes
--
-- Sin necesidad de:
--   ❌ Conocer el orden de dependencias
--   ❌ Eliminar foreign keys
--   ❌ Restaurar nada después
--
-- =====================================================
