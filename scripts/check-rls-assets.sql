-- =====================================================
-- Script de diagnóstico: Verificar RLS de assets
-- =====================================================

-- 1. Verificar si la función user_has_clinic_access existe
SELECT
    'FUNCIÓN user_has_clinic_access:' as verificacion,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc
            WHERE proname = 'user_has_clinic_access'
        )
        THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE'
    END as estado;

-- 2. Ver la definición de la función (si existe)
SELECT
    pg_get_functiondef(oid) as definicion_funcion
FROM pg_proc
WHERE proname = 'user_has_clinic_access';

-- 3. Verificar políticas RLS en la tabla assets
SELECT
    '═══════════════════════════════' as separador;

SELECT
    'POLÍTICAS RLS DE ASSETS:' as verificacion;

SELECT
    policyname as "Nombre Política",
    cmd as "Comando",
    qual as "Condición USING",
    with_check as "Condición WITH CHECK"
FROM pg_policies
WHERE tablename = 'assets';

-- 4. Verificar si RLS está habilitado en assets
SELECT
    '═══════════════════════════════' as separador;

SELECT
    'RLS habilitado en assets:' as verificacion,
    CASE
        WHEN relrowsecurity THEN '✅ SÍ'
        ELSE '❌ NO'
    END as estado
FROM pg_class
WHERE relname = 'assets';

-- 5. Verificar estructura de workspaces
SELECT
    '═══════════════════════════════' as separador;

SELECT
    'COLUMNAS DE WORKSPACES:' as info;

SELECT
    column_name as "Columna",
    data_type as "Tipo"
FROM information_schema.columns
WHERE table_name = 'workspaces'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Verificar estructura de workspace_members
SELECT
    '═══════════════════════════════' as separador;

SELECT
    'COLUMNAS DE WORKSPACE_MEMBERS:' as info;

SELECT
    column_name as "Columna",
    data_type as "Tipo"
FROM information_schema.columns
WHERE table_name = 'workspace_members'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Resumen
SELECT
    '═══════════════════════════════' as separador;

SELECT
    '📊 RESUMEN DEL PROBLEMA:' as titulo;

SELECT
    CASE
        WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_has_clinic_access')
        THEN '❌ FALTA CREAR LA FUNCIÓN user_has_clinic_access'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assets' AND cmd = 'INSERT')
        THEN '❌ FALTA POLÍTICA DE INSERT EN ASSETS'
        WHEN NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'assets')
        THEN '❌ RLS NO ESTÁ HABILITADO EN ASSETS'
        ELSE '✅ Configuración parece correcta - revisar lógica de la función'
    END as diagnostico;
