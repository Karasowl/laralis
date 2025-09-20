-- =====================================================
-- SCRIPT DE SEGURIDAD RLS PARA LARALIS - VERSIÓN FINAL
-- =====================================================
-- IMPORTANTE: Ejecutar TODO este script en Supabase SQL Editor
-- Esto asegura que cada usuario solo vea sus propios datos
-- =====================================================

-- 1. HABILITAR RLS EN TODAS LAS TABLAS PRINCIPALES
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

-- 2. CREAR FUNCIÓN HELPER PARA VERIFICAR ACCESO
-- =====================================================
-- Eliminar si existe
DROP FUNCTION IF EXISTS user_has_clinic_access(uuid);

-- Crear función que verifica si un usuario tiene acceso a una clínica
CREATE OR REPLACE FUNCTION user_has_clinic_access(p_clinic_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM clinics c
        JOIN workspaces w ON c.workspace_id = w.id
        WHERE c.id = p_clinic_id
        AND w.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. POLÍTICAS PARA WORKSPACES
-- =====================================================
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can insert own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;

CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces" ON workspaces
    FOR DELETE USING (auth.uid() = user_id);

-- 4. POLÍTICAS PARA CLINICS
-- =====================================================
DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Users can insert clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Users can update clinics in their workspaces" ON clinics;
DROP POLICY IF EXISTS "Users can delete clinics in their workspaces" ON clinics;

CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert clinics in their workspaces" ON clinics
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update clinics in their workspaces" ON clinics
    FOR UPDATE USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete clinics in their workspaces" ON clinics
    FOR DELETE USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE user_id = auth.uid()
        )
    );

-- 5. POLÍTICAS PARA PATIENTS
-- =====================================================
DROP POLICY IF EXISTS "Users can view patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can insert patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can update patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can delete patients in their clinics" ON patients;

CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert patients in their clinics" ON patients
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update patients in their clinics" ON patients
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete patients in their clinics" ON patients
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 6. POLÍTICAS PARA TREATMENTS
-- =====================================================
DROP POLICY IF EXISTS "Users can view treatments in their clinics" ON treatments;
DROP POLICY IF EXISTS "Users can insert treatments in their clinics" ON treatments;
DROP POLICY IF EXISTS "Users can update treatments in their clinics" ON treatments;
DROP POLICY IF EXISTS "Users can delete treatments in their clinics" ON treatments;

CREATE POLICY "Users can view treatments in their clinics" ON treatments
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert treatments in their clinics" ON treatments
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update treatments in their clinics" ON treatments
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete treatments in their clinics" ON treatments
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 7. POLÍTICAS PARA EXPENSES
-- =====================================================
DROP POLICY IF EXISTS "Users can view expenses in their clinics" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses in their clinics" ON expenses;
DROP POLICY IF EXISTS "Users can update expenses in their clinics" ON expenses;
DROP POLICY IF EXISTS "Users can delete expenses in their clinics" ON expenses;

CREATE POLICY "Users can view expenses in their clinics" ON expenses
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert expenses in their clinics" ON expenses
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update expenses in their clinics" ON expenses
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete expenses in their clinics" ON expenses
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 8. POLÍTICAS PARA SUPPLIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view supplies in their clinics" ON supplies;
DROP POLICY IF EXISTS "Users can insert supplies in their clinics" ON supplies;
DROP POLICY IF EXISTS "Users can update supplies in their clinics" ON supplies;
DROP POLICY IF EXISTS "Users can delete supplies in their clinics" ON supplies;

CREATE POLICY "Users can view supplies in their clinics" ON supplies
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert supplies in their clinics" ON supplies
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update supplies in their clinics" ON supplies
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete supplies in their clinics" ON supplies
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 9. POLÍTICAS PARA SERVICES
-- =====================================================
DROP POLICY IF EXISTS "Users can view services in their clinics" ON services;
DROP POLICY IF EXISTS "Users can insert services in their clinics" ON services;
DROP POLICY IF EXISTS "Users can update services in their clinics" ON services;
DROP POLICY IF EXISTS "Users can delete services in their clinics" ON services;

CREATE POLICY "Users can view services in their clinics" ON services
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert services in their clinics" ON services
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update services in their clinics" ON services
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete services in their clinics" ON services
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 10. POLÍTICAS PARA SERVICE_SUPPLIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view service_supplies in their services" ON service_supplies;
DROP POLICY IF EXISTS "Users can manage service_supplies in their services" ON service_supplies;

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

-- 11. POLÍTICAS PARA ASSETS
-- =====================================================
DROP POLICY IF EXISTS "Users can view assets in their clinics" ON assets;
DROP POLICY IF EXISTS "Users can insert assets in their clinics" ON assets;
DROP POLICY IF EXISTS "Users can update assets in their clinics" ON assets;
DROP POLICY IF EXISTS "Users can delete assets in their clinics" ON assets;

CREATE POLICY "Users can view assets in their clinics" ON assets
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert assets in their clinics" ON assets
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update assets in their clinics" ON assets
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete assets in their clinics" ON assets
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 12. POLÍTICAS PARA FIXED_COSTS
-- =====================================================
DROP POLICY IF EXISTS "Users can view fixed_costs in their clinics" ON fixed_costs;
DROP POLICY IF EXISTS "Users can insert fixed_costs in their clinics" ON fixed_costs;
DROP POLICY IF EXISTS "Users can update fixed_costs in their clinics" ON fixed_costs;
DROP POLICY IF EXISTS "Users can delete fixed_costs in their clinics" ON fixed_costs;

CREATE POLICY "Users can view fixed_costs in their clinics" ON fixed_costs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert fixed_costs in their clinics" ON fixed_costs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update fixed_costs in their clinics" ON fixed_costs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete fixed_costs in their clinics" ON fixed_costs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 13. POLÍTICAS PARA TARIFFS
-- =====================================================
DROP POLICY IF EXISTS "Users can view tariffs in their clinics" ON tariffs;
DROP POLICY IF EXISTS "Users can insert tariffs in their clinics" ON tariffs;
DROP POLICY IF EXISTS "Users can update tariffs in their clinics" ON tariffs;
DROP POLICY IF EXISTS "Users can delete tariffs in their clinics" ON tariffs;

CREATE POLICY "Users can view tariffs in their clinics" ON tariffs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert tariffs in their clinics" ON tariffs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update tariffs in their clinics" ON tariffs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete tariffs in their clinics" ON tariffs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- 14. POLÍTICAS PARA SETTINGS_TIME
-- =====================================================
DROP POLICY IF EXISTS "Users can view settings_time in their clinics" ON settings_time;
DROP POLICY IF EXISTS "Users can manage settings_time in their clinics" ON settings_time;

CREATE POLICY "Users can view settings_time in their clinics" ON settings_time
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage settings_time in their clinics" ON settings_time
    FOR ALL USING (user_has_clinic_access(clinic_id));

-- 15. POLÍTICAS PARA MARKETING_CAMPAIGNS
-- =====================================================
DROP POLICY IF EXISTS "Users can view marketing_campaigns in their clinics" ON marketing_campaigns;
DROP POLICY IF EXISTS "Users can manage marketing_campaigns in their clinics" ON marketing_campaigns;

CREATE POLICY "Users can view marketing_campaigns in their clinics" ON marketing_campaigns
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can manage marketing_campaigns in their clinics" ON marketing_campaigns
    FOR ALL USING (user_has_clinic_access(clinic_id));

-- 16. POLÍTICAS PARA CATEGORIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view categories in their clinics" ON categories;
DROP POLICY IF EXISTS "Users can manage categories in their clinics" ON categories;

CREATE POLICY "Users can view categories in their clinics" ON categories
    FOR SELECT USING (
        clinic_id IS NULL OR user_has_clinic_access(clinic_id)
    );

CREATE POLICY "Users can manage categories in their clinics" ON categories
    FOR ALL USING (
        clinic_id IS NULL OR user_has_clinic_access(clinic_id)
    );

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que RLS está activo en todas las tablas:
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

-- Debe mostrar rowsecurity = true para todas

-- =====================================================
-- VERIFICAR POLÍTICAS CREADAS
-- =====================================================
SELECT
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'assets',
        'fixed_costs', 'tariffs', 'settings_time',
        'marketing_campaigns', 'categories', 'service_supplies'
    )
ORDER BY tablename, policyname;

-- =====================================================
-- TEST DE SEGURIDAD
-- =====================================================
-- Para probar que funciona correctamente:
-- 1. Crea dos usuarios de prueba
-- 2. Cada uno con su workspace y clínica
-- 3. Verifica que el usuario 1 NO puede ver datos del usuario 2
-- 4. Verifica que el usuario 2 NO puede ver datos del usuario 1

-- =====================================================
-- FIN DEL SCRIPT - RLS ACTIVADO EXITOSAMENTE
-- =====================================================