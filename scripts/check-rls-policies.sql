-- =================================================================
-- VERIFICAR POLÍTICAS RLS ACTUALES
-- =================================================================
-- Este script muestra TODAS las políticas RLS que existen actualmente
-- en las tablas workspaces y clinics
-- =================================================================

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'POLÍTICAS RLS EN WORKSPACES:' as info;

SELECT
    policyname as "Nombre Política",
    cmd as "Comando",
    CASE
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 100)
        ELSE 'N/A'
    END as "Condición USING",
    CASE
        WHEN with_check IS NOT NULL THEN substring(with_check::text, 1, 100)
        ELSE 'N/A'
    END as "Condición WITH CHECK"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'workspaces'
ORDER BY cmd, policyname;

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'POLÍTICAS RLS EN CLINICS:' as info;

SELECT
    policyname as "Nombre Política",
    cmd as "Comando",
    CASE
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 100)
        ELSE 'N/A'
    END as "Condición USING",
    CASE
        WHEN with_check IS NOT NULL THEN substring(with_check::text, 1, 100)
        ELSE 'N/A'
    END as "Condición WITH CHECK"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'clinics'
ORDER BY cmd, policyname;

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'RESUMEN:' as info;

SELECT
    tablename as "Tabla",
    cmd as "Comando",
    COUNT(*) as "# Políticas"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'clinics')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

SELECT
    '═══════════════════════════════════════════════════════' as separador;

SELECT
    'DIAGNÓSTICO:' as info;

SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'workspaces' AND cmd = 'INSERT'
        )
        THEN '❌ FALTA: Política de INSERT en workspaces'
        ELSE '✅ OK: Existe política de INSERT en workspaces'
    END as "Estado Workspaces";

SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'clinics' AND cmd = 'INSERT'
        )
        THEN '❌ FALTA: Política de INSERT en clinics'
        ELSE '✅ OK: Existen ' || COUNT(*)::text || ' política(s) de INSERT en clinics'
    END as "Estado Clinics"
FROM pg_policies
WHERE tablename = 'clinics' AND cmd = 'INSERT';

-- =================================================================
-- INSTRUCCIONES:
-- =================================================================
-- 1. Ejecuta este script en Supabase SQL Editor
-- 2. Mira la sección "DIAGNÓSTICO" al final
-- 3. Si dice "FALTA", ejecuta fix-onboarding-rls-policies.sql
-- 4. Si dice "OK", el problema es otro (no RLS)
-- =================================================================
