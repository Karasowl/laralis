-- ============================================================================
-- Migration 38: Migrar expenses de category (varchar) a category_id (FK)
-- Descripción: Convierte el campo category string a category_id FK a categories
--              Migra datos existentes mapeando strings a IDs de categorías
-- Fecha: 2025-10-20
-- Relacionado: TASK-homogenizar-categorias
-- Prerequisito: Debe ejecutarse DESPUÉS de migration 37 (seed de categorías)
-- ============================================================================

-- PASO 1: Verificar que category_id existe (debería existir según schema actual)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'category_id'
  ) THEN
    -- Crear columna si no existe
    RAISE NOTICE 'Creando columna category_id...';
    ALTER TABLE public.expenses ADD COLUMN category_id UUID REFERENCES public.categories(id);
  ELSE
    RAISE NOTICE '✓ Columna category_id ya existe';
  END IF;
END $$;

-- PASO 2: Migrar datos existentes - Mapear category (string) a category_id
-- Actualizar gastos que tienen category pero no category_id
UPDATE public.expenses e
SET category_id = (
  SELECT c.id
  FROM public.categories c
  WHERE c.entity_type = 'expense'
    AND c.is_system = true
    AND c.clinic_id IS NULL
    AND (
      -- Mapeo case-insensitive con normalización
      LOWER(TRIM(c.name)) = LOWER(TRIM(e.category))
      OR LOWER(TRIM(c.display_name)) = LOWER(TRIM(e.category))
    )
  LIMIT 1
)
WHERE e.category_id IS NULL
  AND e.category IS NOT NULL
  AND TRIM(e.category) != '';

-- PASO 3: Asignar categoría "Otros" a gastos sin categoría válida
DO $$
DECLARE
  otros_id UUID;
  updated_count INTEGER;
BEGIN
  -- Obtener ID de la categoría "Otros"
  SELECT id INTO otros_id
  FROM public.categories
  WHERE entity_type = 'expense'
    AND is_system = true
    AND name = 'otros'
  LIMIT 1;

  IF otros_id IS NULL THEN
    RAISE EXCEPTION 'ERROR: No se encontró la categoría "Otros" del sistema';
  END IF;

  -- Actualizar gastos sin category_id
  UPDATE public.expenses
  SET category_id = otros_id
  WHERE category_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✓ Gastos asignados a categoría "Otros": %', updated_count;
END $$;

-- PASO 4: Hacer category_id NOT NULL
ALTER TABLE public.expenses
ALTER COLUMN category_id SET NOT NULL;

-- PASO 5: Deprecar columna category (NO eliminar todavía, mantener por seguridad)
COMMENT ON COLUMN public.expenses.category IS
  'DEPRECATED: Usar category_id en su lugar. Esta columna se mantendrá por 2 sprints como backup.';

-- PASO 6: Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_expenses_category_id
ON public.expenses(category_id);

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
  total_expenses INTEGER;
  expenses_with_category_id INTEGER;
  expenses_without_category_id INTEGER;
BEGIN
  -- Contar gastos totales
  SELECT COUNT(*) INTO total_expenses
  FROM public.expenses;

  -- Contar gastos con category_id
  SELECT COUNT(*) INTO expenses_with_category_id
  FROM public.expenses
  WHERE category_id IS NOT NULL;

  -- Contar gastos sin category_id (debería ser 0)
  SELECT COUNT(*) INTO expenses_without_category_id
  FROM public.expenses
  WHERE category_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN DE MIGRACIÓN:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de gastos: %', total_expenses;
  RAISE NOTICE 'Gastos con category_id: %', expenses_with_category_id;
  RAISE NOTICE 'Gastos sin category_id: %', expenses_without_category_id;
  RAISE NOTICE '========================================';

  IF expenses_without_category_id > 0 THEN
    RAISE EXCEPTION 'ERROR: Todavía hay % gastos sin category_id!', expenses_without_category_id;
  ELSE
    RAISE NOTICE '✓ MIGRACIÓN EXITOSA: Todos los gastos tienen category_id';
  END IF;
END $$;

-- Mostrar distribución de gastos por categoría
SELECT
  c.display_name AS categoria,
  COUNT(e.id) AS total_gastos,
  SUM(e.amount_cents) / 100.0 AS total_monto,
  CASE
    WHEN c.is_system THEN 'Sistema'
    ELSE 'Custom'
  END as tipo_categoria
FROM public.expenses e
JOIN public.categories c ON e.category_id = c.id
GROUP BY c.id, c.display_name, c.is_system
ORDER BY total_gastos DESC;
