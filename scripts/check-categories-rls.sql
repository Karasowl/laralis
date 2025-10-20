-- ============================================================================
-- Script: Verificar y Agregar Políticas RLS para tabla categories
-- Descripción: Este script verifica las políticas RLS existentes y agrega
--              las necesarias para que CategorySelect funcione correctamente
-- ============================================================================

-- 1. Verificar si RLS está habilitado en la tabla categories
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'categories';

-- 2. Listar todas las políticas RLS existentes para categories
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'categories'
ORDER BY policyname;

-- ============================================================================
-- POLÍTICAS RLS NECESARIAS PARA CATEGORIES
-- ============================================================================

-- Habilitar RLS si no está habilitado
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICA 1: SELECT (Lectura)
-- Los usuarios pueden ver categorías globales (is_system=true, clinic_id=NULL)
-- O categorías de su clínica
-- ============================================================================

CREATE POLICY IF NOT EXISTS "categories_select_policy"
ON categories FOR SELECT
USING (
  -- Categorías globales del sistema (visibles para todos)
  (is_system = true AND clinic_id IS NULL)
  OR
  -- Categorías de la clínica del usuario
  (clinic_id IN (
    SELECT c.id
    FROM clinics c
    INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  ))
);

-- ============================================================================
-- POLÍTICA 2: INSERT (Creación)
-- Los usuarios pueden crear categorías en sus clínicas
-- ============================================================================

CREATE POLICY IF NOT EXISTS "categories_insert_policy"
ON categories FOR INSERT
WITH CHECK (
  -- Solo pueden crear en clínicas donde sean miembros activos
  clinic_id IN (
    SELECT c.id
    FROM clinics c
    INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  AND
  -- No pueden crear categorías de sistema
  is_system = false
);

-- ============================================================================
-- POLÍTICA 3: UPDATE (Actualización)
-- Los usuarios pueden actualizar categorías de su clínica (no del sistema)
-- ============================================================================

CREATE POLICY IF NOT EXISTS "categories_update_policy"
ON categories FOR UPDATE
USING (
  -- Solo categorías de su clínica
  clinic_id IN (
    SELECT c.id
    FROM clinics c
    INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  AND
  -- No pueden editar categorías del sistema
  is_system = false
)
WITH CHECK (
  -- La nueva versión también debe pertenecer a su clínica
  clinic_id IN (
    SELECT c.id
    FROM clinics c
    INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  AND
  -- No pueden convertir en categoría del sistema
  is_system = false
);

-- ============================================================================
-- POLÍTICA 4: DELETE (Eliminación)
-- Los usuarios pueden eliminar categorías de su clínica (no del sistema)
-- ============================================================================

CREATE POLICY IF NOT EXISTS "categories_delete_policy"
ON categories FOR DELETE
USING (
  -- Solo categorías de su clínica
  clinic_id IN (
    SELECT c.id
    FROM clinics c
    INNER JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  AND
  -- No pueden eliminar categorías del sistema
  is_system = false
);

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar que todas las políticas se crearon correctamente
SELECT
  policyname,
  cmd as operacion,
  CASE
    WHEN policyname LIKE '%select%' THEN '✓ Lectura'
    WHEN policyname LIKE '%insert%' THEN '✓ Creación'
    WHEN policyname LIKE '%update%' THEN '✓ Actualización'
    WHEN policyname LIKE '%delete%' THEN '✓ Eliminación'
  END as descripcion
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'categories'
ORDER BY cmd;

-- ============================================================================
-- INSTRUCCIONES
-- ============================================================================
/*
Para ejecutar este script:

1. Copia TODO el contenido de este archivo
2. Ve a Supabase Dashboard → SQL Editor
3. Pega el script completo
4. Ejecuta (Run)
5. Verifica que aparezcan las 4 políticas:
   - categories_select_policy
   - categories_insert_policy
   - categories_update_policy
   - categories_delete_policy

Si ya existen políticas con esos nombres, el script NO las duplicará (IF NOT EXISTS).
*/
