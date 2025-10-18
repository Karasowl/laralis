-- =================================================================
-- SCRIPT COMPLETO: Verificar y corregir onboarding
-- =================================================================
-- Este script:
-- 1. Verifica si RLS está habilitado
-- 2. Habilita RLS si es necesario
-- 3. Agrega las políticas faltantes
-- 4. Verifica que todo esté configurado correctamente
-- =================================================================

-- PASO 1: Verificar estado actual de RLS
SELECT
    schemaname,
    tablename,
    CASE WHEN rowsecurity THEN 'HABILITADO ✅' ELSE 'DESHABILITADO ❌' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'clinics')
ORDER BY tablename;

-- PASO 2: Habilitar RLS si no está habilitado
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- PASO 3: Ver políticas existentes ANTES de agregar las nuevas
SELECT
    tablename as tabla,
    policyname as politica,
    cmd as comando,
    qual as condicion_where,
    with_check as condicion_insert
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'clinics')
ORDER BY tablename, policyname;

-- PASO 4: Agregar política para INSERT en workspaces
DROP POLICY IF EXISTS "Users can create their own workspaces" ON public.workspaces;
CREATE POLICY "Users can create their own workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- PASO 5: Agregar política para INSERT en clinics
DROP POLICY IF EXISTS "Creators can create clinics in their workspace" ON public.clinics;
CREATE POLICY "Creators can create clinics in their workspace" ON public.clinics
  FOR INSERT WITH CHECK (
    -- El usuario es el owner del workspace
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = clinics.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- PASO 6: Verificar que las políticas se crearon correctamente
SELECT
    '========================================' as separador,
    'VERIFICACIÓN FINAL' as titulo;

SELECT
    tablename as tabla,
    policyname as politica,
    cmd as comando
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'clinics')
  AND policyname IN (
    'Users can create their own workspaces',
    'Creators can create clinics in their workspace'
  )
ORDER BY tablename, policyname;

-- PASO 7: Mensaje final
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM pg_policies
              WHERE tablename = 'workspaces'
              AND policyname = 'Users can create their own workspaces') > 0
        AND (SELECT COUNT(*) FROM pg_policies
              WHERE tablename = 'clinics'
              AND policyname = 'Creators can create clinics in their workspace') > 0
        THEN '✅ ÉXITO: Políticas RLS configuradas correctamente'
        ELSE '❌ ERROR: Faltan políticas RLS'
    END as resultado;
