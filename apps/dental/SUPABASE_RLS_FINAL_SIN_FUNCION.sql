-- =====================================================
-- SCRIPT RLS FINAL - NO MODIFICA LA FUNCIÓN
-- =====================================================
-- Solo actualiza políticas, la función queda como está
-- =====================================================

-- PASO 1: LIMPIAR TODAS LAS POLÍTICAS EXISTENTES
-- =====================================================

-- Limpiar TODAS las políticas existentes de cada tabla
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Eliminar todas las políticas de las tablas principales
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN (
            'workspaces', 'clinics', 'patients', 'treatments',
            'expenses', 'supplies', 'services', 'service_supplies',
            'assets', 'fixed_costs', 'tariffs', 'settings_time',
            'marketing_campaigns', 'categories'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- PASO 2: ASEGURAR QUE RLS ESTÁ HABILITADO
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
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- PASO 3: CREAR POLÍTICAS NUEVAS
-- =====================================================
-- NOTA: Usamos la función user_has_clinic_access TAL COMO ESTÁ

-- WORKSPACES - Usando owner_id
CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own workspaces" ON workspaces
    FOR DELETE USING (auth.uid() = owner_id);

-- CLINICS - Solo clínicas en workspaces propios
CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert clinics in their workspaces" ON clinics
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update clinics in their workspaces" ON clinics
    FOR UPDATE USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete clinics in their workspaces" ON clinics
    FOR DELETE USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- PATIENTS
CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert patients in their clinics" ON patients
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update patients in their clinics" ON patients
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete patients in their clinics" ON patients
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- TREATMENTS
CREATE POLICY "Users can view treatments in their clinics" ON treatments
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert treatments in their clinics" ON treatments
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update treatments in their clinics" ON treatments
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete treatments in their clinics" ON treatments
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- EXPENSES
CREATE POLICY "Users can view expenses in their clinics" ON expenses
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert expenses in their clinics" ON expenses
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update expenses in their clinics" ON expenses
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete expenses in their clinics" ON expenses
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SUPPLIES
CREATE POLICY "Users can view supplies in their clinics" ON supplies
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert supplies in their clinics" ON supplies
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update supplies in their clinics" ON supplies
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete supplies in their clinics" ON supplies
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SERVICES
CREATE POLICY "Users can view services in their clinics" ON services
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert services in their clinics" ON services
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update services in their clinics" ON services
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete services in their clinics" ON services
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SERVICE_SUPPLIES
CREATE POLICY "Users can view service_supplies in their services" ON service_supplies
    FOR SELECT USING (
        service_id IN (
            SELECT id FROM services WHERE user_has_clinic_access(clinic_id)
        )
    );

CREATE POLICY "Users can manage service_supplies in their services" ON service_supplies
    FOR ALL USING (
        service_id IN (
            SELECT id FROM services WHERE user_has_clinic_access(clinic_id)
        )
    );

-- ASSETS
CREATE POLICY "Users can view assets in their clinics" ON assets
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert assets in their clinics" ON assets
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update assets in their clinics" ON assets
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete assets in their clinics" ON assets
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- FIXED_COSTS
CREATE POLICY "Users can view fixed_costs in their clinics" ON fixed_costs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert fixed_costs in their clinics" ON fixed_costs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update fixed_costs in their clinics" ON fixed_costs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete fixed_costs in their clinics" ON fixed_costs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- TARIFFS
CREATE POLICY "Users can view tariffs in their clinics" ON tariffs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert tariffs in their clinics" ON tariffs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update tariffs in their clinics" ON tariffs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete tariffs in their clinics" ON tariffs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SETTINGS_TIME
CREATE POLICY "Users can view settings_time in their clinics" ON settings_time
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage settings_time in their clinics" ON settings_time
    FOR ALL USING (user_has_clinic_access(clinic_id));

-- MARKETING_CAMPAIGNS
CREATE POLICY "Users can view marketing_campaigns in their clinics" ON marketing_campaigns
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage marketing_campaigns in their clinics" ON marketing_campaigns
    FOR ALL USING (user_has_clinic_access(clinic_id));

-- CATEGORIES
CREATE POLICY "Users can view categories in their clinics" ON categories
    FOR SELECT USING (
        clinic_id IS NULL OR user_has_clinic_access(clinic_id)
    );

CREATE POLICY "Users can manage categories in their clinics" ON categories
    FOR ALL USING (
        clinic_id IS NULL OR user_has_clinic_access(clinic_id)
    );

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- 1. Verificar que RLS está activo:
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'assets',
        'fixed_costs', 'tariffs', 'settings_time',
        'marketing_campaigns', 'categories', 'service_supplies'
    )
ORDER BY tablename;

-- 2. Contar políticas por tabla:
SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 3. Ver detalle de la función existente (NO LA MODIFICAMOS):
SELECT
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE proname = 'user_has_clinic_access';

-- =====================================================
-- SI LA FUNCIÓN USA user_id EN VEZ DE owner_id
-- =====================================================
-- Si ves que la función usa 'user_id' pero workspaces tiene 'owner_id',
-- necesitarás ejecutar esto por separado:
--
-- DROP FUNCTION user_has_clinic_access(uuid) CASCADE;
--
-- CREATE FUNCTION user_has_clinic_access(p_clinic_id uuid)
-- RETURNS boolean AS $$
-- BEGIN
--     RETURN EXISTS (
--         SELECT 1 FROM clinics c
--         JOIN workspaces w ON c.workspace_id = w.id
--         WHERE c.id = p_clinic_id
--         AND w.owner_id = auth.uid()
--     );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- Y luego volver a ejecutar este script desde el PASO 1

-- =====================================================
-- ÉXITO - RLS CONFIGURADO
-- =====================================================
-- Las políticas están listas
-- Cada usuario solo ve SUS propios datos
-- =====================================================