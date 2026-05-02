-- =====================================================
-- PASO 1: VERIFICAR ESTADO ACTUAL
-- =====================================================
-- Ejecuta TODO este archivo primero para ver qué tienes
-- =====================================================

-- Ver qué tablas tienen RLS activo:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'workspaces', 'clinics', 'patients', 'treatments',
    'expenses', 'supplies', 'services', 'assets'
)
ORDER BY tablename;

-- Ver políticas existentes:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Ver la función helper:
SELECT prosrc as function_code
FROM pg_proc
WHERE proname = 'user_has_clinic_access';

-- Contar cuántas políticas tiene cada tabla:
SELECT
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;