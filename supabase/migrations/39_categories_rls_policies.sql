-- ============================================================================
-- Migration 39: Políticas RLS para tabla categories
-- Descripción: Implementa Row Level Security para garantizar multi-tenancy
--              seguro en la tabla categories
-- Fecha: 2025-10-20
-- Relacionado: TASK-homogenizar-categorias
-- ============================================================================

-- PASO 1: Habilitar RLS si no está habilitado
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICA 1: SELECT (Lectura)
-- Los usuarios pueden ver:
-- - Categorías globales del sistema (is_system=true, clinic_id=NULL)
-- - Categorías de sus clínicas (donde son miembros activos)
-- ============================================================================

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;

CREATE POLICY "categories_select_policy"
ON public.categories
FOR SELECT
USING (
  -- Categorías globales del sistema (visibles para todos)
  (is_system = true AND clinic_id IS NULL)
  OR
  -- Categorías de clínicas donde el usuario es miembro activo
  (clinic_id IN (
    SELECT c.id
    FROM public.clinics c
    INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  ))
);

-- ============================================================================
-- POLÍTICA 2: INSERT (Creación)
-- Los usuarios pueden crear categorías custom en sus clínicas
-- NO pueden crear categorías de sistema (is_system=false obligatorio)
-- ============================================================================

DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;

CREATE POLICY "categories_insert_policy"
ON public.categories
FOR INSERT
WITH CHECK (
  -- Solo pueden crear en clínicas donde sean miembros activos
  clinic_id IN (
    SELECT c.id
    FROM public.clinics c
    INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  AND
  -- No pueden crear categorías de sistema
  is_system = false
  AND
  -- clinic_id debe estar presente (no NULL)
  clinic_id IS NOT NULL
);

-- ============================================================================
-- POLÍTICA 3: UPDATE (Actualización)
-- Los usuarios pueden actualizar solo categorías custom de sus clínicas
-- NO pueden editar categorías del sistema
-- ============================================================================

DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;

CREATE POLICY "categories_update_policy"
ON public.categories
FOR UPDATE
USING (
  -- Solo categorías custom de su clínica
  clinic_id IN (
    SELECT c.id
    FROM public.clinics c
    INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
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
    FROM public.clinics c
    INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  AND
  -- No pueden convertir en categoría del sistema
  is_system = false
  AND
  -- No pueden cambiar clinic_id
  clinic_id IS NOT NULL
);

-- ============================================================================
-- POLÍTICA 4: DELETE (Eliminación)
-- Los usuarios pueden eliminar solo categorías custom de sus clínicas
-- NO pueden eliminar categorías del sistema
-- ============================================================================

DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

CREATE POLICY "categories_delete_policy"
ON public.categories
FOR DELETE
USING (
  -- Solo categorías custom de su clínica
  clinic_id IN (
    SELECT c.id
    FROM public.clinics c
    INNER JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
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

DO $$
DECLARE
  policy_count INTEGER;
  expected_policies INTEGER := 4;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'categories';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'POLÍTICAS RLS PARA CATEGORIES';
  RAISE NOTICE '========================================';

  IF policy_count >= expected_policies THEN
    RAISE NOTICE '✓ Total de políticas creadas: %', policy_count;
  ELSE
    RAISE WARNING 'Se esperaban % políticas, pero se encontraron %', expected_policies, policy_count;
  END IF;

  -- Mostrar todas las políticas
  RAISE NOTICE '';
  RAISE NOTICE 'Políticas activas:';

  FOR i IN
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  - % (%)  ', i.policyname, i.cmd;
  END LOOP;

  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- TEST (Opcional - Solo para verificación manual)
-- ============================================================================

-- Descomentar para ver qué categorías vería el usuario actual
-- SELECT
--   entity_type,
--   display_name,
--   CASE
--     WHEN is_system THEN 'Sistema'
--     ELSE 'Custom'
--   END as tipo,
--   CASE
--     WHEN clinic_id IS NULL THEN 'Global'
--     ELSE 'Clínica: ' || clinic_id::text
--   END as alcance
-- FROM public.categories
-- ORDER BY entity_type, is_system DESC, display_order;
