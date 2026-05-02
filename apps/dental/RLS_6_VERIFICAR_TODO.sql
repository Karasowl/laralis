-- =====================================================
-- PASO 6: VERIFICACIÓN FINAL
-- =====================================================
-- Ejecuta TODO este archivo al final
-- =====================================================

-- 1. Verificar que RLS está activo en todas las tablas:
SELECT
    tablename,
    CASE WHEN rowsecurity THEN '✅ ACTIVO' ELSE '❌ INACTIVO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'assets',
        'fixed_costs', 'tariffs', 'settings_time',
        'service_supplies'
    )
ORDER BY tablename;

-- 2. Contar políticas por tabla:
SELECT
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) >= 2 THEN '✅ OK'
        WHEN COUNT(*) = 1 THEN '⚠️ Pocas políticas'
        ELSE '❌ Sin políticas'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 3. Verificar la función helper:
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✅ Función user_has_clinic_access existe'
        ELSE '❌ Función NO existe'
    END as function_status
FROM pg_proc
WHERE proname = 'user_has_clinic_access';

-- 4. Test de seguridad - Ejecuta esto con un usuario de prueba:
-- Debería ver solo SUS propios datos
SELECT 'Workspaces' as tabla, COUNT(*) as registros FROM workspaces
UNION ALL
SELECT 'Clinics', COUNT(*) FROM clinics
UNION ALL
SELECT 'Patients', COUNT(*) FROM patients
UNION ALL
SELECT 'Treatments', COUNT(*) FROM treatments;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Todas las tablas con rls_status = ACTIVO
-- ✅ Cada tabla con 2-4 políticas
-- ✅ Función user_has_clinic_access existe
-- ✅ Cada usuario solo ve SUS registros
-- =====================================================