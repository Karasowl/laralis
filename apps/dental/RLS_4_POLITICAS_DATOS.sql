-- =====================================================
-- PASO 4: POLÍTICAS PARA DATOS DE PACIENTES Y SERVICIOS
-- =====================================================
-- Ejecuta TODO este archivo cuarto
-- =====================================================

-- PATIENTS
DROP POLICY IF EXISTS "Users can view patients in their clinics" ON patients;
DROP POLICY IF EXISTS "Users can create patients" ON patients;
DROP POLICY IF EXISTS "Users can update patients" ON patients;
DROP POLICY IF EXISTS "Owners and admins can delete patients" ON patients;

CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert patients in their clinics" ON patients
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update patients in their clinics" ON patients
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete patients in their clinics" ON patients
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- TREATMENTS
DROP POLICY IF EXISTS "Users can view treatments in their clinics" ON treatments;
DROP POLICY IF EXISTS "Users can create treatments" ON treatments;
DROP POLICY IF EXISTS "Users can update treatments" ON treatments;
DROP POLICY IF EXISTS "Owners and admins can delete treatments" ON treatments;

CREATE POLICY "Users can view treatments in their clinics" ON treatments
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert treatments in their clinics" ON treatments
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update treatments in their clinics" ON treatments
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete treatments in their clinics" ON treatments
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- EXPENSES
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can manage expenses" ON expenses;

CREATE POLICY "Users can view expenses in their clinics" ON expenses
    FOR SELECT USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can insert expenses in their clinics" ON expenses
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can update expenses in their clinics" ON expenses
    FOR UPDATE USING (user_has_clinic_access(clinic_id));

CREATE POLICY "Users can delete expenses in their clinics" ON expenses
    FOR DELETE USING (user_has_clinic_access(clinic_id));

-- Verificar:
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('patients', 'treatments', 'expenses')
GROUP BY tablename;