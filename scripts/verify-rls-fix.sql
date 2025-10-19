-- =====================================================
-- VERIFICACIÓN: Estado de RLS después del fix
-- =====================================================
-- Ejecuta este script DESPUÉS de aplicar fix-rls-policies-complete.sql
-- para confirmar que todo se aplicó correctamente
-- =====================================================

-- 1. Verificar que las funciones helper existen
SELECT '1. FUNCIONES HELPER' as seccion;

SELECT
    proname as funcion,
    '✅ EXISTE' as status
FROM pg_proc
WHERE proname IN ('user_has_workspace_access', 'user_has_clinic_access')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- Si no aparecen 2 funciones, algo salió mal ❌

-- 2. Verificar que RLS está habilitado en todas las tablas críticas
SELECT '2. RLS HABILITADO' as seccion;

SELECT
    tablename,
    CASE WHEN rowsecurity THEN '✅ ACTIVO' ELSE '❌ INACTIVO' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
ORDER BY tablename;

-- Todas deben mostrar "✅ ACTIVO"

-- 3. Contar políticas por tabla (debe ser 4 por tabla)
SELECT '3. POLÍTICAS POR TABLA' as seccion;

SELECT
    tablename,
    COUNT(*) as politicas,
    CASE
        WHEN COUNT(*) = 4 THEN '✅ COMPLETO (4/4)'
        WHEN COUNT(*) >= 2 THEN '⚠️ PARCIAL (' || COUNT(*) || '/4)'
        ELSE '❌ INCOMPLETO (' || COUNT(*) || '/4)'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
GROUP BY tablename
ORDER BY tablename;

-- Todas deben tener 4 políticas ✅

-- 4. Listar políticas de las tablas CRÍTICAS para el fix
SELECT '4. POLÍTICAS CRÍTICAS (services, treatments, expenses)' as seccion;

SELECT
    tablename,
    policyname,
    cmd as operacion
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('services', 'service_supplies', 'treatments', 'expenses', 'supplies')
ORDER BY tablename, cmd;

-- Cada tabla debe tener 4 políticas: SELECT, INSERT, UPDATE, DELETE

-- 5. Test rápido de las funciones helper
SELECT '5. TEST FUNCIONES HELPER' as seccion;

DO $$
DECLARE
    v_test_workspace_id UUID;
    v_test_clinic_id UUID;
    v_has_access BOOLEAN;
BEGIN
    -- Obtener el workspace y clínica del usuario actual
    SELECT id INTO v_test_workspace_id
    FROM workspaces
    WHERE owner_id = auth.uid()
    LIMIT 1;

    IF v_test_workspace_id IS NOT NULL THEN
        -- Test workspace access
        SELECT user_has_workspace_access(v_test_workspace_id) INTO v_has_access;
        IF v_has_access THEN
            RAISE NOTICE '✅ user_has_workspace_access funciona correctamente';
        ELSE
            RAISE WARNING '❌ user_has_workspace_access retorna FALSE (esperaba TRUE)';
        END IF;

        -- Test clinic access
        SELECT id INTO v_test_clinic_id
        FROM clinics
        WHERE workspace_id = v_test_workspace_id
        LIMIT 1;

        IF v_test_clinic_id IS NOT NULL THEN
            SELECT user_has_clinic_access(v_test_clinic_id) INTO v_has_access;
            IF v_has_access THEN
                RAISE NOTICE '✅ user_has_clinic_access funciona correctamente';
            ELSE
                RAISE WARNING '❌ user_has_clinic_access retorna FALSE (esperaba TRUE)';
            END IF;
        ELSE
            RAISE NOTICE '⚠️ No hay clínicas para testear user_has_clinic_access';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ No hay workspaces para testear las funciones helper';
    END IF;
END $$;

-- 6. Resumen final
SELECT '6. RESUMEN FINAL' as seccion;

SELECT
    'Tablas con RLS activo' as metrica,
    COUNT(*) || '/10' as valor,
    CASE WHEN COUNT(*) = 10 THEN '✅' ELSE '❌' END as status
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
        'workspaces', 'clinics', 'patients', 'treatments',
        'expenses', 'supplies', 'services', 'service_supplies',
        'assets', 'fixed_costs'
    )
UNION ALL
SELECT
    'Tablas con 4+ políticas',
    COUNT(*) || '/10',
    CASE WHEN COUNT(*) >= 10 THEN '✅' ELSE '❌' END
FROM (
    SELECT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
            'workspaces', 'clinics', 'patients', 'treatments',
            'expenses', 'supplies', 'services', 'service_supplies',
            'assets', 'fixed_costs'
        )
    GROUP BY tablename
    HAVING COUNT(*) >= 4
) subq
UNION ALL
SELECT
    'Funciones helper',
    COUNT(*) || '/2',
    CASE WHEN COUNT(*) = 2 THEN '✅' ELSE '❌' END
FROM pg_proc
WHERE proname IN ('user_has_workspace_access', 'user_has_clinic_access')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =====================================================
-- INTERPRETACIÓN DE RESULTADOS:
-- =====================================================
--
-- ✅ TODO OK:
-- - 2 funciones helper existen
-- - 10 tablas con RLS activo
-- - 10 tablas con 4 políticas cada una
-- - Tests de funciones pasan
--
-- ❌ PROBLEMAS:
-- - Si falta alguna función → Reejecutar fix-rls-policies-complete.sql
-- - Si alguna tabla no tiene RLS → Reejecutar fix-rls-policies-complete.sql
-- - Si alguna tabla tiene <4 políticas → Revisar errores en la ejecución
--
-- =====================================================
