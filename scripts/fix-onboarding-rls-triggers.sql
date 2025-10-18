-- =================================================================
-- FIX: Políticas RLS para tablas usadas por triggers de clinics
-- =================================================================
--
-- PROBLEMA:
-- Al crear una clínica, hay triggers que automáticamente insertan:
-- 1. patient_sources (8 fuentes por defecto)
-- 2. custom_categories (~25 categorías por defecto)
--
-- Estos triggers FALLAN porque estas tablas no tienen políticas RLS
-- de INSERT que permitan al owner del workspace insertar datos.
--
-- ERROR EXACTO:
-- "new row violates row-level security policy for table \"custom_categories\""
-- =================================================================

-- PASO 1: Verificar si las tablas tienen RLS habilitado
SELECT
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS HABILITADO' ELSE '❌ RLS DESHABILITADO' END as estado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types')
ORDER BY tablename;

-- PASO 2: Habilitar RLS en las tablas (si no está habilitado)
ALTER TABLE public.patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_types ENABLE ROW LEVEL SECURITY;

-- PASO 3: Ver políticas existentes
SELECT
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types')
ORDER BY tablename, cmd, policyname;

-- =================================================================
-- POLÍTICAS PARA patient_sources
-- =================================================================

-- SELECT: Los usuarios pueden ver las fuentes de sus clínicas
DROP POLICY IF EXISTS "Users can view patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can view patient sources in their clinics" ON public.patient_sources
  FOR SELECT USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- INSERT: Los usuarios pueden insertar fuentes en sus clínicas
DROP POLICY IF EXISTS "Users can insert patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can insert patient sources in their clinics" ON public.patient_sources
  FOR INSERT WITH CHECK (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- UPDATE: Los usuarios pueden actualizar fuentes en sus clínicas
DROP POLICY IF EXISTS "Users can update patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can update patient sources in their clinics" ON public.patient_sources
  FOR UPDATE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- DELETE: Los usuarios pueden eliminar fuentes en sus clínicas (solo las no-system)
DROP POLICY IF EXISTS "Users can delete custom patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can delete custom patient sources in their clinics" ON public.patient_sources
  FOR DELETE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
    AND is_system = false -- Solo permitir borrar las personalizadas
  );

-- =================================================================
-- POLÍTICAS PARA custom_categories
-- =================================================================

-- SELECT: Los usuarios pueden ver las categorías de sus clínicas
DROP POLICY IF EXISTS "Users can view categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can view categories in their clinics" ON public.custom_categories
  FOR SELECT USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- INSERT: Los usuarios pueden insertar categorías en sus clínicas
DROP POLICY IF EXISTS "Users can insert categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can insert categories in their clinics" ON public.custom_categories
  FOR INSERT WITH CHECK (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- UPDATE: Los usuarios pueden actualizar categorías en sus clínicas
DROP POLICY IF EXISTS "Users can update categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can update categories in their clinics" ON public.custom_categories
  FOR UPDATE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- DELETE: Los usuarios pueden eliminar categorías en sus clínicas (solo las no-system)
DROP POLICY IF EXISTS "Users can delete custom categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can delete custom categories in their clinics" ON public.custom_categories
  FOR DELETE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
    AND is_system = false -- Solo permitir borrar las personalizadas
  );

-- =================================================================
-- POLÍTICAS PARA category_types (tabla de solo lectura)
-- =================================================================

-- SELECT: Todos los usuarios autenticados pueden ver los tipos de categorías
DROP POLICY IF EXISTS "Authenticated users can view category types" ON public.category_types;
CREATE POLICY "Authenticated users can view category types" ON public.category_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =================================================================
-- VERIFICACIÓN FINAL
-- =================================================================

SELECT
    '========================================' as separador,
    'VERIFICACIÓN DE POLÍTICAS CREADAS' as titulo;

SELECT
    tablename as tabla,
    policyname as politica,
    cmd as comando
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types')
ORDER BY tablename, cmd, policyname;

-- Mensaje de éxito
SELECT
    CASE
        WHEN (
            SELECT COUNT(*) FROM pg_policies
            WHERE tablename = 'patient_sources' AND cmd = 'INSERT'
        ) > 0
        AND (
            SELECT COUNT(*) FROM pg_policies
            WHERE tablename = 'custom_categories' AND cmd = 'INSERT'
        ) > 0
        THEN '✅ ÉXITO: Políticas RLS configuradas correctamente para triggers'
        ELSE '❌ ERROR: Faltan políticas RLS'
    END as resultado;
