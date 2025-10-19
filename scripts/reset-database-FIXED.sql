-- =====================================================
-- SCRIPT DE RESET MEJORADO - Compatible con RLS y Triggers
-- =====================================================
-- PROBLEMA DEL SCRIPT ANTERIOR:
-- - Los triggers se ejecutan durante TRUNCATE
-- - Si las funciones NO son SECURITY DEFINER, fallan por RLS
-- - El reset falla parcialmente dejando datos huérfanos
--
-- SOLUCIÓN:
-- 1. Deshabilitar triggers ANTES del reset
-- 2. Deshabilitar RLS
-- 3. Truncar todo
-- 4. Re-habilitar RLS
-- 5. Re-habilitar triggers
-- 6. Asegurar funciones SECURITY DEFINER
-- =====================================================

DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    total_deleted BIGINT := 0;
    v_trigger_count INT;
    v_is_sec_definer BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESET COMPLETO DE BASE DE DATOS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 1: CONTEO ANTES DE BORRAR
    -- ============================================================================
    RAISE NOTICE '1️⃣ Conteo ANTES de borrar:';
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
    RAISE NOTICE 'TOTAL: % registros', total_deleted;
    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 2: DESHABILITAR TRIGGERS TEMPORALMENTE
    -- ============================================================================
    RAISE NOTICE '2️⃣ Deshabilitando triggers en clinics...';

    v_trigger_count := 0;

    FOR r IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'clinics'::regclass
        AND tgname IN ('trigger_insert_default_patient_sources', 'trigger_insert_default_categories')
    LOOP
        EXECUTE format('ALTER TABLE clinics DISABLE TRIGGER %I', r.tgname);
        v_trigger_count := v_trigger_count + 1;
        RAISE NOTICE '  ✓ Deshabilitado: %', r.tgname;
    END LOOP;

    IF v_trigger_count = 0 THEN
        RAISE NOTICE '  ℹ️ No se encontraron triggers para deshabilitar';
    ELSE
        RAISE NOTICE '  ✓ % triggers deshabilitados', v_trigger_count;
    END IF;
    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 3: DESHABILITAR RLS
    -- ============================================================================
    RAISE NOTICE '3️⃣ Deshabilitando RLS en todas las tablas...';

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
    -- PASO 4: TRUNCAR TODAS LAS TABLAS
    -- ============================================================================
    RAISE NOTICE '4️⃣ Limpiando todas las tablas...';
    RAISE NOTICE '';

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;

            IF row_count > 0 THEN
                EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename);
                RAISE NOTICE '  ✓ %-35s (% registros borrados)', r.tablename, row_count;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  ℹ️ %-35s (ya limpiada por CASCADE)', r.tablename;
        END;
    END LOOP;

    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 5: LIMPIAR USUARIOS DE AUTH
    -- ============================================================================
    RAISE NOTICE '5️⃣ Limpiando usuarios de autenticación...';

    BEGIN
        SELECT COUNT(*) INTO row_count FROM auth.users;
        DELETE FROM auth.users;
        RAISE NOTICE '  ✓ % usuarios eliminados', row_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ⚠️ Error: %', SQLERRM;
        RAISE NOTICE '  → Borrar manualmente desde Dashboard > Authentication > Users';
    END;

    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 6: RE-HABILITAR RLS
    -- ============================================================================
    RAISE NOTICE '6️⃣ Re-habilitando RLS...';

    FOR r IN
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;

    RAISE NOTICE '  ✓ RLS re-habilitado en todas las tablas';
    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 7: RE-HABILITAR TRIGGERS
    -- ============================================================================
    RAISE NOTICE '7️⃣ Re-habilitando triggers...';

    v_trigger_count := 0;

    FOR r IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'clinics'::regclass
        AND tgname IN ('trigger_insert_default_patient_sources', 'trigger_insert_default_categories')
    LOOP
        EXECUTE format('ALTER TABLE clinics ENABLE TRIGGER %I', r.tgname);
        v_trigger_count := v_trigger_count + 1;
        RAISE NOTICE '  ✓ Habilitado: %', r.tgname;
    END LOOP;

    IF v_trigger_count > 0 THEN
        RAISE NOTICE '  ✓ % triggers re-habilitados', v_trigger_count;
    END IF;
    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 8: VERIFICAR QUE FUNCIONES SEAN SECURITY DEFINER
    -- ============================================================================
    RAISE NOTICE '8️⃣ Verificando funciones SECURITY DEFINER...';

    -- Verificar insert_default_patient_sources
    SELECT prosecdef INTO v_is_sec_definer FROM pg_proc WHERE proname = 'insert_default_patient_sources';
    IF v_is_sec_definer THEN
        RAISE NOTICE '  ✓ insert_default_patient_sources es SECURITY DEFINER';
    ELSE
        RAISE NOTICE '  ⚠️ insert_default_patient_sources NO es SECURITY DEFINER';
        RAISE NOTICE '  → Ejecutar FIX-ONBOARDING-COMPLETO-V3.sql';
    END IF;

    -- Verificar insert_default_categories
    SELECT prosecdef INTO v_is_sec_definer FROM pg_proc WHERE proname = 'insert_default_categories';
    IF v_is_sec_definer THEN
        RAISE NOTICE '  ✓ insert_default_categories es SECURITY DEFINER';
    ELSE
        RAISE NOTICE '  ⚠️ insert_default_categories NO es SECURITY DEFINER';
        RAISE NOTICE '  → Ejecutar FIX-ONBOARDING-COMPLETO-V3.sql';
    END IF;

    RAISE NOTICE '';

    -- ============================================================================
    -- PASO 9: VERIFICACIÓN FINAL
    -- ============================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN FINAL';
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
            RAISE NOTICE '  ⚠️ %-35s todavía tiene % registros', r.tablename, row_count;
        END IF;
        total_deleted := total_deleted + row_count;
    END LOOP;

    SELECT COUNT(*) INTO row_count FROM auth.users;
    IF row_count > 0 THEN
        RAISE NOTICE '  ⚠️ auth.users todavía tiene % usuarios', row_count;
    END IF;
    total_deleted := total_deleted + row_count;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';

    IF total_deleted = 0 THEN
        RAISE NOTICE '✅ RESET COMPLETADO EXITOSAMENTE';
        RAISE NOTICE '   Base de datos completamente limpia';
    ELSE
        RAISE NOTICE '⚠️ RESET PARCIAL';
        RAISE NOTICE '   Quedan % registros', total_deleted;
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 SIGUIENTE PASO:';
    RAISE NOTICE '  1. Cerrar TODAS las pestañas del navegador';
    RAISE NOTICE '  2. Abrir navegador en modo incógnito';
    RAISE NOTICE '  3. Ir a la aplicación';
    RAISE NOTICE '  4. Registrar nuevo usuario';
    RAISE NOTICE '  5. Completar onboarding';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ IMPORTANTE:';
    RAISE NOTICE '  - NO usar el mismo navegador sin limpiar caché';
    RAISE NOTICE '  - Las cookies guardan clinicId y causan problemas';
    RAISE NOTICE '  - Modo incógnito garantiza estado limpio';
    RAISE NOTICE '';

END $$;

-- =====================================================
-- ¿POR QUÉ ESTE SCRIPT ES MEJOR?
-- =====================================================
--
-- ✅ Deshabilita triggers ANTES de truncar (evita errores RLS)
-- ✅ Deshabilita RLS temporalmente (permisos completos)
-- ✅ Re-habilita todo al final (seguridad restaurada)
-- ✅ Verifica funciones SECURITY DEFINER (diagnóstico)
-- ✅ Instrucciones claras para el siguiente paso
--
-- =====================================================
-- DIFERENCIAS CON reset-database-simple.sql:
-- =====================================================
--
-- VIEJO (simple):
-- 1. Deshabilita RLS
-- 2. TRUNCATE → ❌ Triggers se ejecutan y fallan
-- 3. Re-habilita RLS
--
-- NUEVO (fixed):
-- 1. Deshabilita TRIGGERS primero ✅
-- 2. Deshabilita RLS
-- 3. TRUNCATE → ✅ Sin triggers, sin errores
-- 4. Re-habilita RLS
-- 5. Re-habilita TRIGGERS ✅
-- 6. Verifica SECURITY DEFINER ✅
--
-- =====================================================
