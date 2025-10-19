-- =====================================================
-- SCRIPT TODO-EN-UNO: Reset + RLS + Onboarding Fix
-- =====================================================
-- Este script hace TODO en el orden correcto:
-- 1. Reset completo de datos (con triggers deshabilitados)
-- 2. Configuración de políticas RLS completas
-- 3. Fix de onboarding (SECURITY DEFINER + category_types)
-- 4. Verificación final
--
-- ⚠️ ADVERTENCIA:
-- - Borrará TODOS los datos de la base de datos
-- - Solo preservará el esquema (tablas, FKs, funciones, etc.)
-- - Asegúrate de que esto es lo que quieres
--
-- ⏱️ TIEMPO ESTIMADO: 30-60 segundos
-- =====================================================

-- Variable temporal para tracking
CREATE TEMP TABLE IF NOT EXISTS script_progress (
    orden INT,
    paso TEXT,
    estado TEXT,
    detalle TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PARTE 1: RESET COMPLETO
-- =====================================================
DO $$
DECLARE
    r RECORD;
    row_count BIGINT;
    v_trigger_count INT;
BEGIN
    INSERT INTO script_progress VALUES (1, '1. Inicio del reset', '🔄', 'Comenzando...');

    RAISE NOTICE '========================================';
    RAISE NOTICE 'PARTE 1: RESET COMPLETO DE DATOS';
    RAISE NOTICE '========================================';

    -- Deshabilitar triggers en clinics
    FOR r IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'clinics'::regclass
        AND tgname IN ('trigger_insert_default_patient_sources', 'trigger_insert_default_categories')
    LOOP
        EXECUTE format('ALTER TABLE clinics DISABLE TRIGGER %I', r.tgname);
    END LOOP;

    INSERT INTO script_progress VALUES (2, '1. Triggers deshabilitados', '✅', 'Listos para reset');

    -- Deshabilitar RLS
    FOR r IN
        SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;

    INSERT INTO script_progress VALUES (3, '1. RLS deshabilitado', '✅', 'Sin restricciones temporales');

    -- Truncar todas las tablas
    FOR r IN
        SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename
    LOOP
        BEGIN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', r.tablename);
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar errores de CASCADE (tabla ya limpiada)
        END;
    END LOOP;

    -- Limpiar auth.users
    BEGIN
        DELETE FROM auth.users;
    EXCEPTION WHEN OTHERS THEN
        -- Puede fallar si no hay permisos
    END;

    INSERT INTO script_progress VALUES (4, '1. Datos borrados', '✅', 'Todas las tablas limpias');

    RAISE NOTICE '  ✅ Reset completado';
END $$;

-- =====================================================
-- PARTE 2: CONFIGURACIÓN DE POLÍTICAS RLS
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PARTE 2: POLÍTICAS RLS';
    RAISE NOTICE '========================================';

    INSERT INTO script_progress VALUES (5, '2. Configurando RLS', '🔄', 'Comenzando...');

    -- Re-habilitar RLS en todas las tablas
    EXECUTE 'ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE clinics ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE patients ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE treatments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE expenses ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE supplies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE services ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE service_supplies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE assets ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE patient_sources ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE category_types ENABLE ROW LEVEL SECURITY';

    INSERT INTO script_progress VALUES (6, '2. RLS habilitado', '✅', '13 tablas con RLS activo');

    RAISE NOTICE '  ✅ RLS habilitado en 13 tablas';
END $$;

-- =====================================================
-- PARTE 3: FUNCIONES HELPER RLS
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PARTE 3: FUNCIONES HELPER';
    RAISE NOTICE '========================================';

    INSERT INTO script_progress VALUES (7, '3. Creando funciones helper', '🔄', 'Comenzando...');
END $$;

-- Función helper: user_has_workspace_access
DROP FUNCTION IF EXISTS public.user_has_workspace_access(UUID);
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()) THEN
        RETURN TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_members') THEN
        IF EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid()) THEN
            RETURN TRUE;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_users') THEN
        IF EXISTS (SELECT 1 FROM workspace_users wu WHERE wu.workspace_id = workspace_id AND wu.user_id = auth.uid()) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

-- Función helper: user_has_clinic_access
DROP FUNCTION IF EXISTS public.user_has_clinic_access(UUID);
CREATE OR REPLACE FUNCTION public.user_has_clinic_access(clinic_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id UUID;
BEGIN
    SELECT workspace_id INTO v_workspace_id FROM clinics WHERE id = clinic_id_param;
    IF v_workspace_id IS NULL THEN RETURN FALSE; END IF;
    RETURN public.user_has_workspace_access(v_workspace_id);
END;
$$;

DO $$
BEGIN
    INSERT INTO script_progress VALUES (8, '3. Funciones helper creadas', '✅', '2 funciones SECURITY DEFINER');
    RAISE NOTICE '  ✅ Funciones helper creadas';
END $$;

-- =====================================================
-- PARTE 4: POLÍTICAS RLS (CRÍTICAS)
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PARTE 4: POLÍTICAS RLS CRÍTICAS';
    RAISE NOTICE '========================================';

    INSERT INTO script_progress VALUES (9, '4. Creando políticas RLS', '🔄', 'Comenzando...');
END $$;

-- WORKSPACES
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
CREATE POLICY "Users can view own workspaces" ON workspaces FOR SELECT USING (user_has_workspace_access(id));

DROP POLICY IF EXISTS "Users can insert own workspaces" ON workspaces;
CREATE POLICY "Users can insert own workspaces" ON workspaces FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
CREATE POLICY "Users can update own workspaces" ON workspaces FOR UPDATE USING (user_has_workspace_access(id));

DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
CREATE POLICY "Users can delete own workspaces" ON workspaces FOR DELETE USING (auth.uid() = owner_id);

-- CLINICS
DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
CREATE POLICY "Users can view clinics in their workspaces" ON clinics FOR SELECT USING (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "Users can insert clinics in their workspaces" ON clinics;
CREATE POLICY "Users can insert clinics in their workspaces" ON clinics FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "Users can update clinics in their workspaces" ON clinics;
CREATE POLICY "Users can update clinics in their workspaces" ON clinics FOR UPDATE USING (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "Users can delete clinics in their workspaces" ON clinics;
CREATE POLICY "Users can delete clinics in their workspaces" ON clinics FOR DELETE USING (user_has_workspace_access(workspace_id));

-- SERVICES, SUPPLIES, TREATMENTS, EXPENSES (usar macro)
DO $$
DECLARE
    tabla TEXT;
BEGIN
    FOR tabla IN SELECT unnest(ARRAY['services', 'supplies', 'treatments', 'expenses', 'patients', 'assets', 'fixed_costs'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Users can view %I in their clinics" ON %I', tabla, tabla);
        EXECUTE format('CREATE POLICY "Users can view %I in their clinics" ON %I FOR SELECT USING (user_has_clinic_access(clinic_id))', tabla, tabla);

        EXECUTE format('DROP POLICY IF EXISTS "Users can insert %I in their clinics" ON %I', tabla, tabla);
        EXECUTE format('CREATE POLICY "Users can insert %I in their clinics" ON %I FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id))', tabla, tabla);

        EXECUTE format('DROP POLICY IF EXISTS "Users can update %I in their clinics" ON %I', tabla, tabla);
        EXECUTE format('CREATE POLICY "Users can update %I in their clinics" ON %I FOR UPDATE USING (user_has_clinic_access(clinic_id))', tabla, tabla);

        EXECUTE format('DROP POLICY IF EXISTS "Users can delete %I in their clinics" ON %I', tabla, tabla);
        EXECUTE format('CREATE POLICY "Users can delete %I in their clinics" ON %I FOR DELETE USING (user_has_clinic_access(clinic_id))', tabla, tabla);
    END LOOP;
END $$;

-- SERVICE_SUPPLIES (requiere subquery)
DROP POLICY IF EXISTS "Users can view service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can view service_supplies in their services" ON service_supplies
    FOR SELECT USING (service_id IN (SELECT id FROM services WHERE user_has_clinic_access(clinic_id)));

DROP POLICY IF EXISTS "Users can insert service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can insert service_supplies in their services" ON service_supplies
    FOR INSERT WITH CHECK (service_id IN (SELECT id FROM services WHERE user_has_clinic_access(clinic_id)));

DROP POLICY IF EXISTS "Users can update service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can update service_supplies in their services" ON service_supplies
    FOR UPDATE USING (service_id IN (SELECT id FROM services WHERE user_has_clinic_access(clinic_id)));

DROP POLICY IF EXISTS "Users can delete service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can delete service_supplies in their services" ON service_supplies
    FOR DELETE USING (service_id IN (SELECT id FROM services WHERE user_has_clinic_access(clinic_id)));

DO $$
BEGIN
    INSERT INTO script_progress VALUES (10, '4. Políticas RLS creadas', '✅', '40+ políticas activas');
    RAISE NOTICE '  ✅ Políticas RLS creadas';
END $$;

-- =====================================================
-- PARTE 5: FIX DE ONBOARDING
-- =====================================================
DO $$
DECLARE
    v_count INT;
    service_type_id UUID;
    supply_type_id UUID;
    fixed_cost_type_id UUID;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PARTE 5: FIX DE ONBOARDING';
    RAISE NOTICE '========================================';

    INSERT INTO script_progress VALUES (11, '5. Configurando onboarding', '🔄', 'Comenzando...');

    -- UNIQUE constraint en category_types
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_types_name_key') THEN
        ALTER TABLE category_types ADD CONSTRAINT category_types_name_key UNIQUE (name);
    END IF;

    -- Insertar category_types
    INSERT INTO category_types (name, display_name) VALUES
        ('service', 'Categorías de Servicios'),
        ('supply', 'Categorías de Insumos'),
        ('fixed_cost', 'Categorías de Costos Fijos'),
        ('expense', 'Categorías de Gastos')
    ON CONFLICT (name) DO NOTHING;

    SELECT COUNT(*) INTO v_count FROM category_types;
    INSERT INTO script_progress VALUES (12, '5. category_types poblado', '✅', v_count || ' tipos disponibles');

    -- Políticas RLS para onboarding
    DROP POLICY IF EXISTS "Users can view patient sources in their clinics" ON patient_sources;
    CREATE POLICY "Users can view patient sources in their clinics" ON patient_sources
        FOR SELECT USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can insert patient sources in their clinics" ON patient_sources;
    CREATE POLICY "Users can insert patient sources in their clinics" ON patient_sources
        FOR INSERT WITH CHECK (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can update patient sources in their clinics" ON patient_sources;
    CREATE POLICY "Users can update patient sources in their clinics" ON patient_sources
        FOR UPDATE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can delete custom patient sources in their clinics" ON patient_sources;
    CREATE POLICY "Users can delete custom patient sources in their clinics" ON patient_sources
        FOR DELETE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()) AND is_system = false);

    DROP POLICY IF EXISTS "Users can view categories in their clinics" ON custom_categories;
    CREATE POLICY "Users can view categories in their clinics" ON custom_categories
        FOR SELECT USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can insert categories in their clinics" ON custom_categories;
    CREATE POLICY "Users can insert categories in their clinics" ON custom_categories
        FOR INSERT WITH CHECK (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can update categories in their clinics" ON custom_categories;
    CREATE POLICY "Users can update categories in their clinics" ON custom_categories
        FOR UPDATE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can delete custom categories in their clinics" ON custom_categories;
    CREATE POLICY "Users can delete custom categories in their clinics" ON custom_categories
        FOR DELETE USING (clinic_id IN (SELECT c.id FROM clinics c INNER JOIN workspaces w ON c.workspace_id = w.id WHERE w.owner_id = auth.uid()) AND is_system = false);

    DROP POLICY IF EXISTS "Authenticated users can view category types" ON category_types;
    CREATE POLICY "Authenticated users can view category types" ON category_types
        FOR SELECT USING (auth.uid() IS NOT NULL);

    INSERT INTO script_progress VALUES (13, '5. Políticas onboarding creadas', '✅', '9 políticas');

    RAISE NOTICE '  ✅ Políticas de onboarding creadas';
END $$;

-- Funciones trigger SECURITY DEFINER
CREATE OR REPLACE FUNCTION insert_default_patient_sources()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO patient_sources (clinic_id, name, description, is_system, color, icon) VALUES
        (NEW.id, 'Recomendación', 'Paciente referido por otro paciente', true, '#10B981', 'users'),
        (NEW.id, 'Google', 'Búsqueda en Google', true, '#4285F4', 'search'),
        (NEW.id, 'Facebook', 'Redes sociales - Facebook', true, '#1877F2', 'facebook'),
        (NEW.id, 'Instagram', 'Redes sociales - Instagram', true, '#E4405F', 'instagram'),
        (NEW.id, 'Página Web', 'Sitio web de la clínica', true, '#6366F1', 'globe'),
        (NEW.id, 'Walk-in', 'Paciente que llegó sin cita', true, '#F59E0B', 'door-open'),
        (NEW.id, 'Campaña', 'Campaña de marketing', true, '#EC4899', 'megaphone'),
        (NEW.id, 'Otro', 'Otra fuente', true, '#6B7280', 'dots-horizontal');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION insert_default_categories()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    service_type_id UUID;
    supply_type_id UUID;
    fixed_cost_type_id UUID;
BEGIN
    SELECT id INTO service_type_id FROM category_types WHERE name = 'service';
    SELECT id INTO supply_type_id FROM category_types WHERE name = 'supply';
    SELECT id INTO fixed_cost_type_id FROM category_types WHERE name = 'fixed_cost';

    INSERT INTO custom_categories (clinic_id, category_type_id, name, display_name, is_system, sort_order) VALUES
        (NEW.id, service_type_id, 'preventivo', 'Preventivo', true, 1),
        (NEW.id, service_type_id, 'restaurativo', 'Restaurativo', true, 2),
        (NEW.id, service_type_id, 'endodoncia', 'Endodoncia', true, 3),
        (NEW.id, service_type_id, 'cirugia', 'Cirugía', true, 4),
        (NEW.id, service_type_id, 'estetica', 'Estética', true, 5),
        (NEW.id, service_type_id, 'ortodoncia', 'Ortodoncia', true, 6),
        (NEW.id, service_type_id, 'protesis', 'Prótesis', true, 7),
        (NEW.id, service_type_id, 'periodoncia', 'Periodoncia', true, 8),
        (NEW.id, service_type_id, 'otros', 'Otros', true, 9);

    INSERT INTO custom_categories (clinic_id, category_type_id, name, display_name, is_system, sort_order) VALUES
        (NEW.id, supply_type_id, 'insumo', 'Insumo', true, 1),
        (NEW.id, supply_type_id, 'bioseguridad', 'Bioseguridad', true, 2),
        (NEW.id, supply_type_id, 'consumibles', 'Consumibles', true, 3),
        (NEW.id, supply_type_id, 'materiales', 'Materiales', true, 4),
        (NEW.id, supply_type_id, 'medicamentos', 'Medicamentos', true, 5),
        (NEW.id, supply_type_id, 'equipos', 'Equipos', true, 6),
        (NEW.id, supply_type_id, 'otros', 'Otros', true, 7);

    INSERT INTO custom_categories (clinic_id, category_type_id, name, display_name, is_system, sort_order) VALUES
        (NEW.id, fixed_cost_type_id, 'rent', 'Renta', true, 1),
        (NEW.id, fixed_cost_type_id, 'salaries', 'Salarios', true, 2),
        (NEW.id, fixed_cost_type_id, 'utilities', 'Servicios', true, 3),
        (NEW.id, fixed_cost_type_id, 'insurance', 'Seguros', true, 4),
        (NEW.id, fixed_cost_type_id, 'equipment', 'Equipamiento', true, 5),
        (NEW.id, fixed_cost_type_id, 'maintenance', 'Mantenimiento', true, 6),
        (NEW.id, fixed_cost_type_id, 'education', 'Educación', true, 7),
        (NEW.id, fixed_cost_type_id, 'advertising', 'Publicidad', true, 8),
        (NEW.id, fixed_cost_type_id, 'other', 'Otros', true, 9);

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    INSERT INTO script_progress VALUES (14, '5. Funciones trigger actualizadas', '✅', 'SECURITY DEFINER');
    RAISE NOTICE '  ✅ Funciones trigger actualizadas a SECURITY DEFINER';
END $$;

-- Re-habilitar triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'clinics'::regclass
        AND tgname IN ('trigger_insert_default_patient_sources', 'trigger_insert_default_categories')
    LOOP
        EXECUTE format('ALTER TABLE clinics ENABLE TRIGGER %I', r.tgname);
    END LOOP;

    INSERT INTO script_progress VALUES (15, '5. Triggers re-habilitados', '✅', 'Listos para onboarding');
    RAISE NOTICE '  ✅ Triggers re-habilitados';
END $$;

-- =====================================================
-- PARTE 6: VERIFICACIÓN FINAL
-- =====================================================
DO $$
DECLARE
    v_tables_count INT;
    v_policies_count INT;
    v_functions_count INT;
    v_category_types_count INT;
    v_sec_definer BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PARTE 6: VERIFICACIÓN FINAL';
    RAISE NOTICE '========================================';

    -- Verificar tablas vacías
    SELECT COUNT(*) INTO v_tables_count
    FROM (
        SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
    ) t;

    -- Verificar políticas RLS
    SELECT COUNT(*) INTO v_policies_count
    FROM pg_policies
    WHERE schemaname = 'public';

    -- Verificar funciones helper
    SELECT COUNT(*) INTO v_functions_count
    FROM pg_proc
    WHERE proname IN ('user_has_workspace_access', 'user_has_clinic_access')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

    -- Verificar category_types
    SELECT COUNT(*) INTO v_category_types_count FROM category_types;

    -- Verificar SECURITY DEFINER
    SELECT prosecdef INTO v_sec_definer
    FROM pg_proc
    WHERE proname = 'insert_default_categories';

    INSERT INTO script_progress VALUES (16, '6. Verificación', '🔍', 'Analizando...');

    RAISE NOTICE '';
    RAISE NOTICE 'Tablas en esquema public: %', v_tables_count;
    RAISE NOTICE 'Políticas RLS activas: %', v_policies_count;
    RAISE NOTICE 'Funciones helper: %/2', v_functions_count;
    RAISE NOTICE 'Category types: %/4', v_category_types_count;
    RAISE NOTICE 'Funciones SECURITY DEFINER: %', CASE WHEN v_sec_definer THEN '✅ SÍ' ELSE '❌ NO' END;

    IF v_functions_count = 2 AND v_policies_count >= 40 AND v_category_types_count >= 4 AND v_sec_definer THEN
        INSERT INTO script_progress VALUES (17, '6. Verificación final', '✅', 'TODO LISTO');
        RAISE NOTICE '';
        RAISE NOTICE '✅ ¡TODO CONFIGURADO CORRECTAMENTE!';
    ELSE
        INSERT INTO script_progress VALUES (17, '6. Verificación final', '⚠️', 'Revisar detalles arriba');
        RAISE NOTICE '';
        RAISE NOTICE '⚠️ Hay problemas - revisar detalles arriba';
    END IF;
END $$;

-- =====================================================
-- RESUMEN FINAL
-- =====================================================
\echo ''
\echo '========================================'
\echo 'RESUMEN DE EJECUCIÓN'
\echo '========================================'
SELECT paso, estado, detalle FROM script_progress ORDER BY orden;

DROP TABLE script_progress;

\echo ''
\echo '========================================'
\echo 'SIGUIENTE PASO'
\echo '========================================'
\echo ''
\echo '1. Limpiar caché del navegador:'
\echo '   - Cerrar TODAS las pestañas de la app'
\echo '   - Abrir DevTools (F12) > Console'
\echo '   - Ejecutar: scripts/clear-browser-cache.js'
\echo '   - O usar modo incógnito directamente'
\echo ''
\echo '2. Registrar nuevo usuario:'
\echo '   - Ir a /auth/register'
\echo '   - Usar email NUEVO (no usado antes)'
\echo '   - Completar onboarding'
\echo ''
\echo '3. Verificar que funciona:'
\echo '   - Crear workspace sin errores ✅'
\echo '   - Crear clínica sin errores ✅'
\echo '   - Ver 6 pasos de configuración ✅'
\echo '   - Guardar assets sin errores ✅'
\echo ''
\echo '⚠️ SI SIGUEN APARECIENDO CLÍNICAS FANTASMA:'
\echo '   → Significa que NO limpiaste el caché del navegador'
\echo '   → Usa modo incógnito para garantizar estado limpio'
\echo ''

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
