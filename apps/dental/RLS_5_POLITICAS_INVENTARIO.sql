-- =====================================================
-- PASO 5: POLÍTICAS PARA INVENTARIO Y SERVICIOS
-- =====================================================
-- Ejecuta TODO este archivo quinto
-- =====================================================

-- SUPPLIES
DROP POLICY IF EXISTS "Users can view supplies" ON supplies;
DROP POLICY IF EXISTS "Users can manage supplies" ON supplies;

CREATE POLICY "Users can view supplies in their clinics" ON supplies
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert supplies in their clinics" ON supplies
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update supplies in their clinics" ON supplies
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete supplies in their clinics" ON supplies
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SERVICES
DROP POLICY IF EXISTS "Users can view services" ON services;
DROP POLICY IF EXISTS "Users can manage services" ON services;

CREATE POLICY "Users can view services in their clinics" ON services
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert services in their clinics" ON services
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update services in their clinics" ON services
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete services in their clinics" ON services
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- SERVICE_SUPPLIES
DROP POLICY IF EXISTS "Users can view service supplies" ON service_supplies;
DROP POLICY IF EXISTS "Users can manage service supplies" ON service_supplies;

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
DROP POLICY IF EXISTS "Users can view assets" ON assets;
DROP POLICY IF EXISTS "Admins can manage assets" ON assets;

CREATE POLICY "Users can view assets in their clinics" ON assets
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert assets in their clinics" ON assets
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update assets in their clinics" ON assets
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete assets in their clinics" ON assets
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- FIXED_COSTS
DROP POLICY IF EXISTS "Users can view fixed costs" ON fixed_costs;
DROP POLICY IF EXISTS "Admins can manage fixed costs" ON fixed_costs;

CREATE POLICY "Users can view fixed_costs in their clinics" ON fixed_costs
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert fixed_costs in their clinics" ON fixed_costs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update fixed_costs in their clinics" ON fixed_costs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete fixed_costs in their clinics" ON fixed_costs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- Verificar:
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('supplies', 'services', 'service_supplies', 'assets', 'fixed_costs')
GROUP BY tablename;