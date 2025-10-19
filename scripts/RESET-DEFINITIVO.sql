-- =====================================================
-- SCRIPT DE RESET DEFINITIVO
-- =====================================================
-- Borra todos los datos de usuario Y re-crea datos del sistema
-- Muestra TODO el resultado al final en una sola tabla
-- =====================================================

CREATE TEMP TABLE IF NOT EXISTS reset_log (
    orden SERIAL,
    paso TEXT,
    estado TEXT,
    detalle TEXT
);

-- ============================================================================
-- PASO 1: Conteo inicial
-- ============================================================================
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    total BIGINT := 0;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;
        IF row_count > 0 THEN
            INSERT INTO reset_log (paso, estado, detalle)
            VALUES ('1. Conteo inicial', r.tablename, row_count || ' registros');
            total := total + row_count;
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO row_count FROM auth.users;
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('1. Conteo inicial', 'auth.users', row_count || ' usuarios');
    total := total + row_count;

    INSERT INTO reset_log (paso, estado, detalle) VALUES ('1. Conteo inicial', '📊 TOTAL', total || ' registros');
END $$;

-- ============================================================================
-- PASO 2: Deshabilitar triggers
-- ============================================================================
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

-- ============================================================================
-- PASO 3: Deshabilitar RLS
-- ============================================================================
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

-- ============================================================================
-- PASO 4: Truncar todas las tablas
-- ============================================================================
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
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('4. Borrado', '📊', deleted || ' tablas vaciadas');
END $$;

-- ============================================================================
-- PASO 5: Borrar usuarios de auth
-- ============================================================================
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
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('5. Auth', '⚠️', 'Error: ' || SQLERRM);
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('5. Auth', '→', 'Borrar manualmente en Dashboard > Authentication');
END $$;

-- ============================================================================
-- PASO 6: RE-CREAR DATOS DEL SISTEMA (category_types)
-- ============================================================================
DO $$
DECLARE
    inserted INT;
BEGIN
    -- Re-crear los 4 tipos del sistema
    INSERT INTO category_types (name, display_name) VALUES
        ('service', 'Categorías de Servicios'),
        ('supply', 'Categorías de Insumos'),
        ('fixed_cost', 'Categorías de Costos Fijos'),
        ('expense', 'Categorías de Gastos')
    ON CONFLICT (name) DO NOTHING;

    SELECT COUNT(*) INTO inserted FROM category_types;

    INSERT INTO reset_log (paso, estado, detalle)
    VALUES ('6. Seeds del Sistema', '✅', 'category_types poblado con ' || inserted || ' tipos');

    INSERT INTO reset_log (paso, estado, detalle)
    VALUES ('6. Seeds del Sistema', 'ℹ️', 'Tipos: service, supply, fixed_cost, expense');
END $$;

-- ============================================================================
-- PASO 7: Re-habilitar RLS
-- ============================================================================
DO $$
DECLARE
    r RECORD;
    count INT := 0;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', r.tablename);
        count := count + 1;
    END LOOP;
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('7. RLS', '✅', count || ' tablas con RLS re-habilitado');
END $$;

-- ============================================================================
-- PASO 8: Re-habilitar triggers
-- ============================================================================
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
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('8. Triggers', '✅', count || ' triggers re-habilitados');
    END IF;
END $$;

-- ============================================================================
-- PASO 9: Verificar SECURITY DEFINER
-- ============================================================================
DO $$
DECLARE
    v_sec_def BOOLEAN;
    problemas INT := 0;
BEGIN
    SELECT prosecdef INTO v_sec_def FROM pg_proc WHERE proname = 'insert_default_patient_sources';
    IF v_sec_def THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Seguridad', '✅', 'insert_default_patient_sources OK');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Seguridad', '⚠️', 'insert_default_patient_sources NO es SECURITY DEFINER');
        problemas := problemas + 1;
    END IF;

    SELECT prosecdef INTO v_sec_def FROM pg_proc WHERE proname = 'insert_default_categories';
    IF v_sec_def THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Seguridad', '✅', 'insert_default_categories OK');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Seguridad', '⚠️', 'insert_default_categories NO es SECURITY DEFINER');
        problemas := problemas + 1;
    END IF;

    IF problemas > 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('9. Seguridad', '→', 'Ejecutar: FIX-ONBOARDING-COMPLETO-V3.sql');
    END IF;
END $$;

-- ============================================================================
-- PASO 10: Verificación final
-- ============================================================================
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    total BIGINT := 0;
    problemas INT := 0;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO row_count;

        -- category_types DEBE tener 4 registros
        IF r.tablename = 'category_types' AND row_count = 4 THEN
            INSERT INTO reset_log (paso, estado, detalle) VALUES ('10. Verificación', '✅', 'category_types: 4 tipos (correcto)');
        ELSIF r.tablename = 'category_types' AND row_count != 4 THEN
            INSERT INTO reset_log (paso, estado, detalle) VALUES ('10. Verificación', '❌', 'category_types: ' || row_count || ' tipos (debería ser 4)');
            problemas := problemas + 1;
        -- Todas las demás tablas DEBEN estar vacías
        ELSIF r.tablename != 'category_types' AND row_count > 0 THEN
            INSERT INTO reset_log (paso, estado, detalle) VALUES ('10. Verificación', '⚠️', r.tablename || ' tiene ' || row_count || ' registros');
            total := total + row_count;
            problemas := problemas + 1;
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO row_count FROM auth.users;
    IF row_count > 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('10. Verificación', '⚠️', 'auth.users tiene ' || row_count || ' usuarios');
        total := total + row_count;
        problemas := problemas + 1;
    END IF;

    IF total = 0 AND problemas = 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('10. Verificación', '✅', 'Todo limpio y listo');
    ELSIF total > 0 THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('10. Verificación', '❌', 'Quedan ' || total || ' registros de usuario');
    END IF;
END $$;

-- ============================================================================
-- PASO 11: Resultado final
-- ============================================================================
DO $$
DECLARE
    tiene_errores BOOLEAN;
    cat_types_ok BOOLEAN;
BEGIN
    -- Verificar errores
    SELECT EXISTS(SELECT 1 FROM reset_log WHERE estado = '❌') INTO tiene_errores;

    -- Verificar category_types
    SELECT COUNT(*) = 4 INTO cat_types_ok FROM category_types;

    INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
    INSERT INTO reset_log (paso, estado, detalle) VALUES ('========================================', '', '');

    IF cat_types_ok AND NOT tiene_errores THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('RESULTADO', '✅ PERFECTO', 'Reset completado exitosamente');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('Estado', '✅', 'Datos de usuario: BORRADOS');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('Estado', '✅', 'Datos del sistema: RE-CREADOS');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('Estado', '✅', 'category_types: 4 tipos listos');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('SIGUIENTE PASO', '1️⃣', 'Modo incógnito: Ctrl+Shift+N');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '2️⃣', 'Ir a /auth/register');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '3️⃣', 'Email NUEVO (nunca usado)');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '4️⃣', 'Completar onboarding');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '✅', 'Debería funcionar SIN errores');
    ELSIF NOT cat_types_ok THEN
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('RESULTADO', '❌ ERROR', 'category_types no se creó bien');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('QUÉ HACER', '1️⃣', 'Copiar TODO este resultado');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '2️⃣', 'Enviar a Claude para diagnóstico');
    ELSE
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('RESULTADO', '⚠️ PARCIAL', 'Revisar warnings arriba');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '', '');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('QUÉ HACER', '1️⃣', 'Revisar errores marcados con ❌ o ⚠️');
        INSERT INTO reset_log (paso, estado, detalle) VALUES ('', '2️⃣', 'Copiar resultado y enviarlo si necesitas ayuda');
    END IF;

    INSERT INTO reset_log (paso, estado, detalle) VALUES ('========================================', '', '');
END $$;

-- ============================================================================
-- MOSTRAR TODO EL LOG
-- ============================================================================
SELECT
    orden,
    paso,
    estado,
    detalle
FROM reset_log
ORDER BY orden;

-- Limpiar
DROP TABLE reset_log;

-- ============================================================================
-- FIN
-- ============================================================================
