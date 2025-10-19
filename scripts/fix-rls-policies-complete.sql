-- =====================================================
-- FIX COMPLETO: Políticas RLS para todos los módulos
-- =====================================================
-- PROBLEMA:
-- Los endpoints de /api/services y /api/dashboard/revenue
-- están fallando porque faltan políticas RLS en varias tablas:
-- - services
-- - service_supplies
-- - supplies
-- - treatments
-- - expenses
--
-- CAUSA RAÍZ:
-- Solo se ejecutaron políticas para workspaces/clinics durante
-- el fix de onboarding, pero NO para las demás tablas operacionales.
--
-- SOLUCIÓN:
-- 1. Crear funciones helper para verificar acceso
-- 2. Habilitar RLS en todas las tablas
-- 3. Crear políticas RLS completas para cada tabla
-- =====================================================

-- =====================================================
-- PASO 1: CREAR/ACTUALIZAR FUNCIONES HELPER
-- =====================================================

-- Función helper: Verificar acceso a workspace
-- Compatible con workspace_users Y workspace_members
DROP FUNCTION IF EXISTS public.user_has_workspace_access(UUID);
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar si el usuario es owner del workspace
    IF EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = workspace_id
        AND w.owner_id = auth.uid()
    ) THEN
        RETURN TRUE;
    END IF;

    -- Verificar si es miembro en workspace_members (si existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'workspace_members'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Verificar si es miembro en workspace_users (si existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'workspace_users'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM workspace_users wu
            WHERE wu.workspace_id = workspace_id
            AND wu.user_id = auth.uid()
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

-- Función helper: Verificar acceso a clínica
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
    -- Obtener el workspace_id de la clínica
    SELECT workspace_id INTO v_workspace_id
    FROM clinics
    WHERE id = clinic_id_param;

    -- Si no existe la clínica, denegar acceso
    IF v_workspace_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verificar acceso al workspace
    RETURN public.user_has_workspace_access(v_workspace_id);
END;
$$;

-- Verificar que las funciones se crearon correctamente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'user_has_workspace_access'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE EXCEPTION '❌ ERROR: Función user_has_workspace_access NO se creó correctamente';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'user_has_clinic_access'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE EXCEPTION '❌ ERROR: Función user_has_clinic_access NO se creó correctamente';
    END IF;

    RAISE NOTICE '✅ Funciones helper creadas correctamente';
END $$;

-- =====================================================
-- PASO 2: HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

-- Tablas que pueden o no existir (solo habilitar si existen)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tariffs') THEN
        ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings_time') THEN
        ALTER TABLE settings_time ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_categories') THEN
        ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_sources') THEN
        ALTER TABLE patient_sources ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 3: CREAR POLÍTICAS RLS
-- =====================================================

-- ===================
-- WORKSPACES
-- ===================
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT USING (user_has_workspace_access(id));

DROP POLICY IF EXISTS "Users can insert own workspaces" ON workspaces;
CREATE POLICY "Users can insert own workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE USING (user_has_workspace_access(id));

DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;
CREATE POLICY "Users can delete own workspaces" ON workspaces
    FOR DELETE USING (auth.uid() = owner_id);

-- ===================
-- CLINICS
-- ===================
DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT USING (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "Users can insert clinics in their workspaces" ON clinics;
CREATE POLICY "Users can insert clinics in their workspaces" ON clinics
    FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "Users can update clinics in their workspaces" ON clinics;
CREATE POLICY "Users can update clinics in their workspaces" ON clinics
    FOR UPDATE USING (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "Users can delete clinics in their workspaces" ON clinics;
CREATE POLICY "Users can delete clinics in their workspaces" ON clinics
    FOR DELETE USING (user_has_workspace_access(workspace_id));

-- ===================
-- PATIENTS
-- ===================
DROP POLICY IF EXISTS "Users can view patients in their clinics" ON patients;
CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert patients in their clinics" ON patients;
CREATE POLICY "Users can insert patients in their clinics" ON patients
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can update patients in their clinics" ON patients;
CREATE POLICY "Users can update patients in their clinics" ON patients
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can delete patients in their clinics" ON patients;
CREATE POLICY "Users can delete patients in their clinics" ON patients
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ===================
-- TREATMENTS (FIX para dashboard/revenue)
-- ===================
DROP POLICY IF EXISTS "Users can view treatments in their clinics" ON treatments;
CREATE POLICY "Users can view treatments in their clinics" ON treatments
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert treatments in their clinics" ON treatments;
CREATE POLICY "Users can insert treatments in their clinics" ON treatments
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can update treatments in their clinics" ON treatments;
CREATE POLICY "Users can update treatments in their clinics" ON treatments
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can delete treatments in their clinics" ON treatments;
CREATE POLICY "Users can delete treatments in their clinics" ON treatments
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ===================
-- EXPENSES (FIX para dashboard/revenue)
-- ===================
DROP POLICY IF EXISTS "Users can view expenses in their clinics" ON expenses;
CREATE POLICY "Users can view expenses in their clinics" ON expenses
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert expenses in their clinics" ON expenses;
CREATE POLICY "Users can insert expenses in their clinics" ON expenses
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can update expenses in their clinics" ON expenses;
CREATE POLICY "Users can update expenses in their clinics" ON expenses
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can delete expenses in their clinics" ON expenses;
CREATE POLICY "Users can delete expenses in their clinics" ON expenses
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ===================
-- SUPPLIES (FIX para /api/services)
-- ===================
DROP POLICY IF EXISTS "Users can view supplies in their clinics" ON supplies;
CREATE POLICY "Users can view supplies in their clinics" ON supplies
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert supplies in their clinics" ON supplies;
CREATE POLICY "Users can insert supplies in their clinics" ON supplies
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can update supplies in their clinics" ON supplies;
CREATE POLICY "Users can update supplies in their clinics" ON supplies
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can delete supplies in their clinics" ON supplies;
CREATE POLICY "Users can delete supplies in their clinics" ON supplies
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ===================
-- SERVICES (FIX para /api/services) ⭐ CRÍTICO
-- ===================
DROP POLICY IF EXISTS "Users can view services in their clinics" ON services;
CREATE POLICY "Users can view services in their clinics" ON services
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert services in their clinics" ON services;
CREATE POLICY "Users can insert services in their clinics" ON services
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can update services in their clinics" ON services;
CREATE POLICY "Users can update services in their clinics" ON services
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can delete services in their clinics" ON services;
CREATE POLICY "Users can delete services in their clinics" ON services
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ===================
-- SERVICE_SUPPLIES (FIX para /api/services) ⭐ CRÍTICO
-- ===================
DROP POLICY IF EXISTS "Users can view service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can view service_supplies in their services" ON service_supplies
    FOR SELECT USING (
        service_id IN (
            SELECT id FROM services WHERE user_has_clinic_access(clinic_id)
        )
    );

DROP POLICY IF EXISTS "Users can insert service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can insert service_supplies in their services" ON service_supplies
    FOR INSERT WITH CHECK (
        service_id IN (
            SELECT id FROM services WHERE user_has_clinic_access(clinic_id)
        )
    );

DROP POLICY IF EXISTS "Users can update service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can update service_supplies in their services" ON service_supplies
    FOR UPDATE USING (
        service_id IN (
            SELECT id FROM services WHERE user_has_clinic_access(clinic_id)
        )
    );

DROP POLICY IF EXISTS "Users can delete service_supplies in their services" ON service_supplies;
CREATE POLICY "Users can delete service_supplies in their services" ON service_supplies
    FOR DELETE USING (
        service_id IN (
            SELECT id FROM services WHERE user_has_clinic_access(clinic_id)
        )
    );

-- ===================
-- ASSETS
-- ===================
DROP POLICY IF EXISTS "Users can view assets in their clinics" ON assets;
CREATE POLICY "Users can view assets in their clinics" ON assets
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert assets in their clinics" ON assets;
CREATE POLICY "Users can insert assets in their clinics" ON assets
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can update assets in their clinics" ON assets;
CREATE POLICY "Users can update assets in their clinics" ON assets
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can delete assets in their clinics" ON assets;
CREATE POLICY "Users can delete assets in their clinics" ON assets
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ===================
-- FIXED_COSTS
-- ===================
DROP POLICY IF EXISTS "Users can view fixed_costs in their clinics" ON fixed_costs;
CREATE POLICY "Users can view fixed_costs in their clinics" ON fixed_costs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert fixed_costs in their clinics" ON fixed_costs;
CREATE POLICY "Users can insert fixed_costs in their clinics" ON fixed_costs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can update fixed_costs in their clinics" ON fixed_costs;
CREATE POLICY "Users can update fixed_costs in their clinics" ON fixed_costs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can delete fixed_costs in their clinics" ON fixed_costs;
CREATE POLICY "Users can delete fixed_costs in their clinics" ON fixed_costs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ===================
-- TABLAS OPCIONALES
-- ===================

-- TARIFFS (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tariffs') THEN
        DROP POLICY IF EXISTS "Users can view tariffs in their clinics" ON tariffs;
        CREATE POLICY "Users can view tariffs in their clinics" ON tariffs
            FOR SELECT USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can insert tariffs in their clinics" ON tariffs;
        CREATE POLICY "Users can insert tariffs in their clinics" ON tariffs
            FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can update tariffs in their clinics" ON tariffs;
        CREATE POLICY "Users can update tariffs in their clinics" ON tariffs
            FOR UPDATE USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can delete tariffs in their clinics" ON tariffs;
        CREATE POLICY "Users can delete tariffs in their clinics" ON tariffs
            FOR DELETE USING (user_has_clinic_access(clinic_id));

        RAISE NOTICE '✅ Políticas RLS creadas para tariffs';
    END IF;
END $$;

-- SETTINGS_TIME (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings_time') THEN
        DROP POLICY IF EXISTS "Users can view settings_time in their clinics" ON settings_time;
        CREATE POLICY "Users can view settings_time in their clinics" ON settings_time
            FOR SELECT USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can insert settings_time in their clinics" ON settings_time;
        CREATE POLICY "Users can insert settings_time in their clinics" ON settings_time
            FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can update settings_time in their clinics" ON settings_time;
        CREATE POLICY "Users can update settings_time in their clinics" ON settings_time
            FOR UPDATE USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can delete settings_time in their clinics" ON settings_time;
        CREATE POLICY "Users can delete settings_time in their clinics" ON settings_time
            FOR DELETE USING (user_has_clinic_access(clinic_id));

        RAISE NOTICE '✅ Políticas RLS creadas para settings_time';
    END IF;
END $$;

-- CUSTOM_CATEGORIES (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_categories') THEN
        DROP POLICY IF EXISTS "Users can view custom_categories in their clinics" ON custom_categories;
        CREATE POLICY "Users can view custom_categories in their clinics" ON custom_categories
            FOR SELECT USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can insert custom_categories in their clinics" ON custom_categories;
        CREATE POLICY "Users can insert custom_categories in their clinics" ON custom_categories
            FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can update custom_categories in their clinics" ON custom_categories;
        CREATE POLICY "Users can update custom_categories in their clinics" ON custom_categories
            FOR UPDATE USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can delete custom_categories in their clinics" ON custom_categories;
        CREATE POLICY "Users can delete custom_categories in their clinics" ON custom_categories
            FOR DELETE USING (user_has_clinic_access(clinic_id));

        RAISE NOTICE '✅ Políticas RLS creadas para custom_categories';
    END IF;
END $$;

-- PATIENT_SOURCES (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_sources') THEN
        DROP POLICY IF EXISTS "Users can view patient_sources in their clinics" ON patient_sources;
        CREATE POLICY "Users can view patient_sources in their clinics" ON patient_sources
            FOR SELECT USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can insert patient_sources in their clinics" ON patient_sources;
        CREATE POLICY "Users can insert patient_sources in their clinics" ON patient_sources
            FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can update patient_sources in their clinics" ON patient_sources;
        CREATE POLICY "Users can update patient_sources in their clinics" ON patient_sources
            FOR UPDATE USING (user_has_clinic_access(clinic_id));

        DROP POLICY IF EXISTS "Users can delete patient_sources in their clinics" ON patient_sources;
        CREATE POLICY "Users can delete patient_sources in their clinics" ON patient_sources
            FOR DELETE USING (user_has_clinic_access(clinic_id));

        RAISE NOTICE '✅ Políticas RLS creadas para patient_sources';
    END IF;
END $$;

-- =====================================================
-- PASO 4: VERIFICACIÓN FINAL
-- =====================================================
DO $$
DECLARE
    v_missing_policies TEXT[];
    v_table_name TEXT;
    v_policy_count INT;
    v_total_tables INT := 0;
    v_tables_with_policies INT := 0;
BEGIN
    -- Verificar cada tabla crítica
    FOR v_table_name IN
        SELECT unnest(ARRAY[
            'workspaces', 'clinics', 'patients', 'treatments',
            'expenses', 'supplies', 'services', 'service_supplies',
            'assets', 'fixed_costs'
        ])
    LOOP
        v_total_tables := v_total_tables + 1;

        SELECT COUNT(*) INTO v_policy_count
        FROM pg_policies
        WHERE tablename = v_table_name
        AND schemaname = 'public';

        IF v_policy_count >= 2 THEN
            v_tables_with_policies := v_tables_with_policies + 1;
        ELSE
            v_missing_policies := array_append(v_missing_policies, v_table_name || ' (' || v_policy_count || ' políticas)');
        END IF;
    END LOOP;

    -- Mostrar resultado
    IF v_tables_with_policies = v_total_tables THEN
        RAISE NOTICE '✅ ÉXITO: Todas las tablas críticas (%) tienen políticas RLS', v_total_tables;
    ELSE
        RAISE WARNING '⚠️ ADVERTENCIA: % de % tablas tienen políticas RLS', v_tables_with_policies, v_total_tables;
        IF array_length(v_missing_policies, 1) > 0 THEN
            RAISE WARNING 'Tablas con políticas faltantes: %', array_to_string(v_missing_policies, ', ');
        END IF;
    END IF;
END $$;

-- Mostrar resumen final
SELECT 'VERIFICATION SUMMARY' as section;

SELECT
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) >= 4 THEN '✅ COMPLETO'
        WHEN COUNT(*) >= 2 THEN '⚠️ PARCIAL'
        ELSE '❌ INCOMPLETO'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
GROUP BY tablename
ORDER BY policy_count DESC, tablename;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Funciones helper creadas
-- ✅ RLS habilitado en todas las tablas
-- ✅ Cada tabla con 4 políticas (SELECT, INSERT, UPDATE, DELETE)
-- ✅ /api/services funcionando ✅
-- ✅ /api/dashboard/revenue funcionando ✅
-- =====================================================
