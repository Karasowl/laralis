-- =====================================================
-- VERIFICAR Y COMPLETAR POLÍTICAS FALTANTES
-- =====================================================
-- Primero vemos qué políticas faltan, luego las creamos
-- =====================================================

-- PASO 1: VER QUÉ POLÍTICAS YA EXISTEN
-- =====================================================
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('services', 'assets', 'fixed_costs')
ORDER BY tablename, cmd;

-- PASO 2: CREAR SOLO LAS QUE FALTAN
-- =====================================================

-- SERVICES - Crear solo si no existen
DO $$
BEGIN
    -- UPDATE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'services'
        AND cmd = 'UPDATE'
    ) THEN
        CREATE POLICY "Users can update services in their clinics" ON services
            FOR UPDATE USING (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created UPDATE policy for services';
    ELSE
        RAISE NOTICE 'UPDATE policy for services already exists';
    END IF;

    -- DELETE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'services'
        AND cmd = 'DELETE'
    ) THEN
        CREATE POLICY "Users can delete services in their clinics" ON services
            FOR DELETE USING (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created DELETE policy for services';
    ELSE
        RAISE NOTICE 'DELETE policy for services already exists';
    END IF;
END $$;

-- ASSETS - Crear solo si no existen
DO $$
BEGIN
    -- INSERT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'assets'
        AND cmd = 'INSERT'
    ) THEN
        CREATE POLICY "Users can insert assets in their clinics" ON assets
            FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created INSERT policy for assets';
    ELSE
        RAISE NOTICE 'INSERT policy for assets already exists';
    END IF;

    -- UPDATE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'assets'
        AND cmd = 'UPDATE'
    ) THEN
        CREATE POLICY "Users can update assets in their clinics" ON assets
            FOR UPDATE USING (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created UPDATE policy for assets';
    ELSE
        RAISE NOTICE 'UPDATE policy for assets already exists';
    END IF;

    -- DELETE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'assets'
        AND cmd = 'DELETE'
    ) THEN
        CREATE POLICY "Users can delete assets in their clinics" ON assets
            FOR DELETE USING (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created DELETE policy for assets';
    ELSE
        RAISE NOTICE 'DELETE policy for assets already exists';
    END IF;
END $$;

-- FIXED_COSTS - Crear solo si no existen
DO $$
BEGIN
    -- INSERT policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'fixed_costs'
        AND cmd = 'INSERT'
    ) THEN
        CREATE POLICY "Users can insert fixed_costs in their clinics" ON fixed_costs
            FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created INSERT policy for fixed_costs';
    ELSE
        RAISE NOTICE 'INSERT policy for fixed_costs already exists';
    END IF;

    -- UPDATE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'fixed_costs'
        AND cmd = 'UPDATE'
    ) THEN
        CREATE POLICY "Users can update fixed_costs in their clinics" ON fixed_costs
            FOR UPDATE USING (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created UPDATE policy for fixed_costs';
    ELSE
        RAISE NOTICE 'UPDATE policy for fixed_costs already exists';
    END IF;

    -- DELETE policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'fixed_costs'
        AND cmd = 'DELETE'
    ) THEN
        CREATE POLICY "Users can delete fixed_costs in their clinics" ON fixed_costs
            FOR DELETE USING (user_has_clinic_access(clinic_id));
        RAISE NOTICE 'Created DELETE policy for fixed_costs';
    ELSE
        RAISE NOTICE 'DELETE policy for fixed_costs already exists';
    END IF;
END $$;

-- PASO 3: VERIFICACIÓN FINAL
-- =====================================================
SELECT
    tablename,
    COUNT(*) as total_policies,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_pol,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_pol,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_pol,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_pol,
    CASE
        WHEN COUNT(*) >= 4 THEN '✅ COMPLETO - SEGURO'
        WHEN COUNT(*) >= 2 THEN '⚠️ INCOMPLETO - VULNERABLE'
        ELSE '❌ CRÍTICO'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('services', 'assets', 'fixed_costs')
GROUP BY tablename
ORDER BY tablename;

-- DEBE MOSTRAR:
-- services: 4 políticas (SELECT, INSERT, UPDATE, DELETE) ✅
-- assets: 4+ políticas ✅
-- fixed_costs: 4+ políticas ✅