-- =====================================================
-- SCRIPT DE RESET DEFINITIVO
-- =====================================================
-- Este script muestra TODOS los resultados al final
-- porque Supabase solo muestra el último mensaje
-- =====================================================

-- Crear tabla temporal para acumular mensajes
CREATE TEMP TABLE IF NOT EXISTS reset_log (
    orden SERIAL,
    paso TEXT,
    estado TEXT,
    detalle TEXT
);

-- PASO 1: Contar datos antes de borrar
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    total BIGINT := 0;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            INSERT INTO reset_log (paso, estado, detalle)
            VALUES ('1. Conteo inicial', r.tablename, row_count || ' registros');
            total := total + row_count;
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO row_count FROM auth.users;
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('1. Conteo inicial', 'auth.users', row_count || ' usuarios');

    INSERT INTO reset_log (paso, estado, detalle) VALUES ('1. Conteo inicial', '📊 TOTAL', total + row_count || ' registros en total');
END $$;

-- PASO 2: Deshabilitar triggers
DO $$
DECLARE
    r RECORD;
    count INT := 0;
BEGIN
    FOR r IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'clinics'::regclass
        AND tgname IN ('trigger_insert_default_patient_sources', 'trigger_insert_default_categories')
    LOOP
        EXECUTE format('ALTER TABLE clinics DISABLE TRIGGER %I', r.tgname);
        count := count + 1;
    END LOOP;

    IF count > 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('2. Triggers', '✅', count || ' triggers deshabilitados');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('2. Triggers', 'ℹ️', 'No hay triggers para deshabilitar');
    END IF;
END $$;

-- PASO 3: Deshabilitar RLS
DO $$
DECLARE
    r RECORD;
    count INT := 0;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', r.tablename);
        count := count + 1;
    END LOOP;
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('3. RLS', '✅', count || ' tablas sin RLS (temporal)');
END $$;

-- PASO 4: Truncar todas las tablas
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    deleted INT := 0;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
            IF row_count > 0 THEN
                EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename);
                INSERT INTO reset_log (paso, estado, detalle) VALUES ('4. Borrado', '✅', r.tablename || ' (' || row_count || ' borrados)');
                deleted := deleted + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO reset_log (paso, estado, detalle) VALUES ('4. Borrado', 'ℹ️', r.tablename || ' (ya limpia por CASCADE)');
        END;
    END LOOP;
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('4. Borrado', '📊', deleted || ' tablas truncadas');
END $$;

-- PASO 5: Borrar usuarios de auth
DO $$
DECLARE
    row_count INT;
BEGIN
    SELECT COUNT(*) INTO row_count FROM auth.users;
    IF row_count > 0 THEN
        DELETE FROM auth.users;
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('5. Auth', '✅', row_count || ' usuarios borrados');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('5. Auth', 'ℹ️', 'auth.users ya estaba vacío');
    END IF;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('5. Auth', '❌', 'Error: ' || SQLERRM);
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('5. Auth', '⚠️', 'Borrar manualmente en Dashboard > Authentication');
END $$;

-- PASO 6: Re-habilitar RLS
DO $$
DECLARE
    r RECORD;
    count INT := 0;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', r.tablename);
        count := count + 1;
    END LOOP;
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('6. RLS', '✅', count || ' tablas con RLS re-habilitado');
END $$;

-- PASO 7: Re-habilitar triggers
DO $$
DECLARE
    r RECORD;
    count INT := 0;
BEGIN
    FOR r IN
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'clinics'::regclass
        AND tgname IN ('trigger_insert_default_patient_sources', 'trigger_insert_default_categories')
    LOOP
        EXECUTE format('ALTER TABLE clinics ENABLE TRIGGER %I', r.tgname);
        count := count + 1;
    END LOOP;

    IF count > 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('7. Triggers', '✅', count || ' triggers re-habilitados');
    END IF;
END $$;

-- PASO 8: Verificar SECURITY DEFINER
DO $$
DECLARE
    v_sec_def BOOLEAN;
BEGIN
    SELECT prosecdef INTO v_sec_def FROM pg_proc WHERE proname = 'insert_default_patient_sources';
    IF v_sec_def THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('8. Seguridad', '✅', 'insert_default_patient_sources es SECURITY DEFINER');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('8. Seguridad', '❌', 'insert_default_patient_sources NO es SECURITY DEFINER');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('8. Seguridad', '⚠️', 'Ejecutar: FIX-ONBOARDING-COMPLETO-V3.sql');
    END IF;

    SELECT prosecdef INTO v_sec_def FROM pg_proc WHERE proname = 'insert_default_categories';
    IF v_sec_def THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('8. Seguridad', '✅', 'insert_default_categories es SECURITY DEFINER');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('8. Seguridad', '❌', 'insert_default_categories NO es SECURITY DEFINER');
    END IF;
END $$;

-- PASO 9: Verificación final
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    total BIGINT := 0;
    problemas INT := 0;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Verificación', '⚠️', r.tablename || ' tiene ' || row_count || ' registros');
            total := total + row_count;
            problemas := problemas + 1;
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO row_count FROM auth.users;
    IF row_count > 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Verificación', '⚠️', 'auth.users tiene ' || row_count || ' usuarios');
        total := total + row_count;
        problemas := problemas + 1;
    END IF;

    IF total = 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Verificación', '✅', 'Base de datos COMPLETAMENTE LIMPIA');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Verificación', '❌', 'Quedan ' || total || ' registros sin borrar');
    END IF;
END $$;

-- PASO 10: Resultado final
DO $$
DECLARE
    tiene_errores BOOLEAN;
    total_inicial INT;
    total_final INT;
BEGIN
    -- Verificar si hay errores
    SELECT EXISTS(SELECT 1 FROM reset_log WHERE estado = '❌') INTO tiene_errores;

    -- Obtener totales
    SELECT CAST(SPLIT_PART(detalle, ' ', 1) AS INT) INTO total_inicial
    FROM reset_log WHERE paso = '1. Conteo inicial' AND estado = '📊 TOTAL';

    SELECT COALESCE(SUM(CAST(SPLIT_PART(detalle, ' ', 3) AS INT)), 0) INTO total_final
    FROM reset_log WHERE paso = '9. Verificación' AND estado = '⚠️';

    -- Insertar resultado final
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('========================================', '', '');

    IF total_final = 0 AND NOT tiene_errores THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('RESULTADO FINAL', '✅ ÉXITO', 'Reset completado correctamente');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '📊', 'Borrados: ' || total_inicial || ' registros');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '📊', 'Quedan: 0 registros');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('SIGUIENTE PASO', '1️⃣', 'Abrir navegador en modo incógnito (Ctrl+Shift+N)');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '2️⃣', 'Ir a /auth/register');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '3️⃣', 'Registrar con email NUEVO');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '4️⃣', 'Completar onboarding');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('RESULTADO FINAL', '❌ ERROR', 'Reset INCOMPLETO');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '📊', 'Borrados: ' || (total_inicial - total_final) || ' registros');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '📊', 'Quedan: ' || total_final || ' registros');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('QUÉ HACER', '1️⃣', 'Copiar TODO el resultado de abajo');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '2️⃣', 'Enviar a Isma/Claude para diagnóstico');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '3️⃣', 'NO intentar registrarse hasta que se arregle');
    END IF;

    INSERT INTO reset_log (paso, estado, detalle) VALUES ('========================================', '', '');
END $$;

-- =====================================================
-- MOSTRAR TODO EL LOG (ESTE ES EL ÚNICO OUTPUT)
-- =====================================================
SELECT
    orden,
    paso,
    estado,
    detalle
FROM reset_log
ORDER BY orden;

-- Limpiar tabla temporal
DROP TABLE reset_log;
