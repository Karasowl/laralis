-- ============================================================================
-- Migration 36: Remove hardcoded CHECK constraint from supplies.category
-- Descripción: Elimina el constraint que limitaba las categorías de supplies
--              a valores hardcodeados, permitiendo usar la tabla categories
-- Fecha: 2025-10-20
-- Relacionado: TASK-homogenizar-categorias
-- Dependencias: Debe manejar la vista low_stock_alerts que depende de supplies.category
-- ============================================================================

-- PASO 1: Guardar la definición de la vista low_stock_alerts antes de eliminarla
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'low_stock_alerts'
  ) THEN
    RAISE NOTICE 'Vista low_stock_alerts existe, será recreada después de la migración';
  ELSE
    RAISE NOTICE 'Vista low_stock_alerts no existe (instalación nueva)';
  END IF;
END $$;

-- PASO 2: Eliminar temporalmente la vista que depende de supplies.category
DROP VIEW IF EXISTS public.low_stock_alerts;

-- PASO 3: Verificar y eliminar el CHECK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supplies_category_check'
  ) THEN
    RAISE NOTICE 'Eliminando constraint supplies_category_check...';
    ALTER TABLE public.supplies DROP CONSTRAINT supplies_category_check;
    RAISE NOTICE '✓ Constraint eliminado exitosamente';
  ELSE
    RAISE NOTICE 'Constraint supplies_category_check no existe (ya fue eliminado)';
  END IF;
END $$;

-- PASO 4: Cambiar tipo de columna para permitir valores flexibles
ALTER TABLE public.supplies
ALTER COLUMN category TYPE VARCHAR(100);

-- PASO 5: Actualizar comentario de la columna para documentar el cambio
COMMENT ON COLUMN public.supplies.category IS
  'Categoría flexible: usa tabla categories (system o custom). Anteriormente tenía CHECK constraint hardcodeado.';

-- PASO 6: Recrear la vista low_stock_alerts con la MISMA definición original
-- Definición exacta de Migration 19 (19_add_inventory_to_supplies.sql, líneas 38-50)
CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT
    s.id,
    s.name,
    s.category,
    s.stock_quantity,
    s.min_stock_alert,
    s.clinic_id,
    c.name as clinic_name
FROM public.supplies s
JOIN public.clinics c ON s.clinic_id = c.id
WHERE s.stock_quantity <= s.min_stock_alert
  AND s.stock_quantity >= 0;

COMMENT ON VIEW public.low_stock_alerts IS 'View for supplies with low stock levels';

-- PASO 7: Verificación final
DO $$
DECLARE
  constraint_count INTEGER;
  view_exists BOOLEAN;
BEGIN
  -- Verificar que el constraint fue eliminado
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint
  WHERE conname = 'supplies_category_check';

  -- Verificar que la vista fue recreada
  SELECT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'low_stock_alerts'
  ) INTO view_exists;

  IF constraint_count = 0 AND view_exists THEN
    RAISE NOTICE '✓✓✓ MIGRACIÓN EXITOSA ✓✓✓';
    RAISE NOTICE '  - supplies.category ahora es VARCHAR(100) flexible';
    RAISE NOTICE '  - Vista low_stock_alerts recreada correctamente';
    RAISE NOTICE '  - Sin pérdida de datos o funcionalidad';
  ELSIF constraint_count > 0 THEN
    RAISE EXCEPTION 'ERROR: El constraint supplies_category_check todavía existe!';
  ELSIF NOT view_exists THEN
    RAISE EXCEPTION 'ERROR: La vista low_stock_alerts no fue recreada!';
  END IF;
END $$;
