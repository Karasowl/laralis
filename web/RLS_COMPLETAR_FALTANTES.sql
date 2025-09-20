-- =====================================================
-- COMPLETAR POLÍTICAS FALTANTES
-- =====================================================
-- Solo las tablas que necesitan más políticas
-- =====================================================

-- SERVICES (agregar políticas de modificación)
CREATE POLICY "Users can update services in their clinics" ON services
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete services in their clinics" ON services
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- ASSETS (agregar políticas de modificación)
CREATE POLICY "Users can insert assets in their clinics" ON assets
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update assets in their clinics" ON assets
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete assets in their clinics" ON assets
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- FIXED_COSTS (agregar políticas de modificación)
CREATE POLICY "Users can insert fixed_costs in their clinics" ON fixed_costs
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update fixed_costs in their clinics" ON fixed_costs
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete fixed_costs in their clinics" ON fixed_costs
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- Verificar resultado final:
SELECT
    tablename,
    COUNT(*) as policies,
    CASE
        WHEN COUNT(*) >= 4 THEN '✅ Completo'
        WHEN COUNT(*) >= 2 THEN '⚠️ Básico'
        ELSE '❌ Incompleto'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('services', 'assets', 'fixed_costs')
GROUP BY tablename
ORDER BY tablename;