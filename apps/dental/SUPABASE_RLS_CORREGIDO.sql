-- =====================================================
-- SCRIPT RLS CORREGIDO - USA owner_id EN WORKSPACES
-- =====================================================
-- Este script usa los nombres de columna correctos
-- =====================================================

-- PASO 1: LIMPIAR TODAS LAS POLÍTICAS EXISTENTES
-- =====================================================

-- Limpiar políticas de treatments
DROP POLICY IF EXISTS "Users can view treatments in their clinics" ON treatments;
DROP POLICY IF EXISTS "Users can create treatments" ON treatments;
DROP POLICY IF EXISTS "Users can update treatments" ON treatments;
DROP POLICY IF EXISTS "Owners and admins can delete treatments" ON treatments;
DROP POLICY IF EXISTS "Users can insert treatments in their clinics" ON treatments;
DROP POLICY IF EXISTS "Users can update treatments in their clinics" ON treatments;
DROP POLICY IF EXISTS "Users can delete treatments in their clinics" ON treatments;

-- Limpiar políticas de expenses
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can manage expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view expenses in their clinics" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses in their clinics" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses in their clinics" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses in their clinics" ON expenses;

-- Limpiar políticas de patients
DROP POLICY IF EXISTS "Users can view patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can create patients" ON patients;
DROP POLICY IF EXISTS "Users can update patients" ON patients;
DROP POLICY IF EXISTS "Owners and admins can delete patients" ON patients;
DROP POLICY IF EXISTS "Users can insert patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can update patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can delete patients in their clinics" ON patients;

-- Limpiar políticas de settings_time
DROP POLICY IF EXISTS "Users can view time settings" ON settings_time;
DROP POLICY IF EXISTS "Admins can manage time settings" ON settings_time;
DROP POLICY IF EXISTS "Users can view settings_time in their clinics" ON settings_time;
DROP POLICY IF EXISTS "Users can manage settings_time in their clinics" ON settings_time;

-- Limpiar políticas de assets
DROP POLICY IF EXISTS "Users can view assets" ON assets;
DROP POLICY IF EXISTS "Admins can manage assets" ON assets;
DROP POLICY IF EXISTS "Users can view assets in their clinics" ON assets;
DROP POLICY IF EXISTS "Users can insert assets in their clinics" ON assets;
DROP POLICY IF EXISTS "Users can update assets in their clinics" ON assets;
DROP POLICY IF EXISTS "Users can delete assets in their clinics" ON assets;

-- Limpiar políticas de fixed_costs
DROP POLICY IF EXISTS "Users can view fixed costs" ON fixed_costs;
DROP POLICY IF EXISTS "Admins can manage fixed costs" ON fixed_costs;
DROP POLICY IF EXISTS "Users can view fixed_costs in their clinics" ON fixed_costs;
DROP POLICY IF EXISTS "Users can insert fixed_costs in their clinics" ON fixed_costs;
DROP POLICY IF EXISTS "Users can update fixed_costs in their clinics" ON fixed_costs;
DROP POLICY IF EXISTS "Users can delete fixed_costs in their clinics" ON fixed_costs;

-- Limpiar políticas de supplies
DROP POLICY IF EXISTS "Users can view supplies" ON supplies;
DROP POLICY IF EXISTS "Users can manage supplies" ON supplies;
DROP POLICY IF EXISTS "Users can view supplies in their clinics" ON supplies;
DROP POLICY IF EXISTS "Users can insert supplies in their clinics" ON supplies;
DROP POLICY IF EXISTS "Users can update supplies in their clinics" ON supplies;
DROP POLICY IF EXISTS "Users can delete supplies in their clinics" ON supplies;

-- Limpiar políticas de services
DROP POLICY IF EXISTS "Users can view services" ON services;
DROP POLICY IF EXISTS "Users can manage services" ON services;
DROP POLICY IF EXISTS "Users can view services in their clinics" ON services;
DROP POLICY IF EXISTS "Users can insert services in their clinics" ON services;
DROP POLICY IF EXISTS "Users can update services in their clinics" ON services;
DROP POLICY IF EXISTS "Users can delete services in their clinics" ON services;

-- Limpiar políticas de service_supplies
DROP POLICY IF EXISTS "Users can view service supplies" ON service_supplies;
DROP POLICY IF EXISTS "Users can manage service supplies" ON service_supplies;
DROP POLICY IF EXISTS "Users can view service_supplies in their services" ON service_supplies;
DROP POLICY IF EXISTS "Users can manage service_supplies in their services" ON service_supplies;

-- Limpiar políticas de tariffs
DROP POLICY IF EXISTS "Users can view tariffs" ON tariffs;
DROP POLICY IF EXISTS "Admins can manage tariffs" ON tariffs;
DROP POLICY IF EXISTS "Users can view tariffs in their clinics" ON tariffs;
DROP POLICY IF EXISTS "Users can insert tariffs in their clinics" ON tariffs;
DROP POLICY IF EXISTS "Users can update tariffs in their clinics" ON tariffs;
DROP POLICY IF EXISTS "Users can delete tariffs in their clinics" ON tariffs;

-- Limpiar políticas de workspaces
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can insert own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;

-- Limpiar políticas de clinics
DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Users can insert clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Users can update clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Users can delete clinics in their workspaces" ON clinics;

-- Limpiar políticas de marketing_campaigns
DROP POLICY IF EXISTS "Users can view marketing_campaigns in their clinics" ON marketing_campaigns;
DROP POLICY IF EXISTS "Users can manage marketing_campaigns in their clinics" ON marketing_campaigns;

-- Limpiar políticas de categories
DROP POLICY IF EXISTS "Users can view categories in their clinics" ON categories;
DROP POLICY IF EXISTS "Users can manage categories in their clinics" ON categories;

-- PASO 2: VER ESTRUCTURA DE LA TABLA WORKSPACES
-- =====================================================
-- Primero veamos qué columnas tiene workspaces
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workspaces'
ORDER BY ordinal_position;

-- PASO 3: ASEGURAR QUE RLS ESTÁ HABILITADO
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

-- PASO 4: CREAR NUEVAS POLÍTICAS USANDO owner_id
-- =====================================================

-- WORKSPACES - Usando owner_id (NO user_id)
CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own workspaces" ON workspaces
    FOR DELETE USING (auth.uid() = owner_id);

-- CLINICS - Solo clínicas en workspaces propios (usando owner_id)
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

-- PATIENTS - Solo en clínicas con acceso
CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert patients in their clinics" ON patients
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update patients in their clinics" ON patients
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete patients in their clinics" ON patients
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- TREATMENTS - Solo en clínicas con acceso
CREATE POLICY "Users can view treatments in their clinics" ON treatments
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert treatments in their clinics" ON treatments
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update treatments in their clinics" ON treatments
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete treatments in their clinics" ON treatments
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- EXPENSES - Solo en clínicas con acceso
CREATE POLICY "Users can view expenses in their clinics" ON expenses
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert expenses in their clinics" ON expenses
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update expenses in their clinics" ON expenses
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete expenses in their clinics" ON expenses
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SUPPLIES - Solo en clínicas con acceso
CREATE POLICY "Users can view supplies in their clinics" ON supplies
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert supplies in their clinics" ON supplies
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update supplies in their clinics" ON supplies
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete supplies in their clinics" ON supplies
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SERVICES - Solo en clínicas con acceso
CREATE POLICY "Users can view services in their clinics" ON services
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert services in their clinics" ON services
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update services in their clinics" ON services
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete services in their clinics" ON services
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SERVICE_SUPPLIES - Solo servicios con acceso
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

-- ASSETS - Solo en clínicas con acceso
CREATE POLICY "Users can view assets in their clinics" ON assets
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert assets in their clinics" ON assets
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update assets in their clinics" ON assets
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete assets in their clinics" ON assets
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- FIXED_COSTS - Solo en clínicas con acceso
CREATE POLICY "Users can view fixed_costs in their clinics" ON fixed_costs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert fixed_costs in their clinics" ON fixed_costs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update fixed_costs in their clinics" ON fixed_costs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete fixed_costs in their clinics" ON fixed_costs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- TARIFFS - Solo en clínicas con acceso
CREATE POLICY "Users can view tariffs in their clinics" ON tariffs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert tariffs in their clinics" ON tariffs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update tariffs in their clinics" ON tariffs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete tariffs in their clinics" ON tariffs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SETTINGS_TIME - Solo en clínicas con acceso
CREATE POLICY "Users can view settings_time in their clinics" ON settings_time
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage settings_time in their clinics" ON settings_time
    FOR ALL USING (user_has_clinic_access(clinic_id));

-- MARKETING_CAMPAIGNS - Solo en clínicas con acceso
CREATE POLICY "Users can view marketing_campaigns in their clinics" ON marketing_campaigns
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage marketing_campaigns in their clinics" ON marketing_campaigns
    FOR ALL USING (user_has_clinic_access(clinic_id));

-- CATEGORIES - Pueden ser globales o de clínica
CREATE POLICY "Users can view categories in their clinics" ON categories
    FOR SELECT USING (
        clinic_id IS NULL OR user_has_clinic_access(clinic_id)
    );

CREATE POLICY "Users can manage categories in their clinics" ON categories
    FOR ALL USING (
        clinic_id IS NULL OR user_has_clinic_access(clinic_id)
    );

-- =====================================================
-- VERIFICACIÓN Y DEBUG
-- =====================================================

-- Ver función actual y cómo está implementada:
SELECT
    proname as function_name,
    prosrc as function_code
FROM pg_proc
WHERE proname = 'user_has_clinic_access';

-- La función probablemente también necesite actualizarse
-- para usar owner_id en lugar de user_id:
CREATE OR REPLACE FUNCTION user_has_clinic_access(p_clinic_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM clinics c
        JOIN workspaces w ON c.workspace_id = w.id
        WHERE c.id = p_clinic_id
        AND w.owner_id = auth.uid()  -- CAMBIADO de user_id a owner_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Ver estado de RLS:
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

-- Ver cuántas políticas tiene cada tabla:
SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- =====================================================
-- ÉXITO - RLS CONFIGURADO CON owner_id
-- =====================================================