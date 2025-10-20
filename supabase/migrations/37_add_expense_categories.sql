-- ============================================================================
-- Migration 37: Seed categorías de sistema para expenses
-- Descripción: Pre-pobla la tabla categories con categorías predefinidas
--              para el módulo de gastos (expenses)
-- Fecha: 2025-10-20
-- Relacionado: TASK-homogenizar-categorias
-- ============================================================================

-- Insertar categorías del sistema para expenses
-- Nota: ON CONFLICT DO NOTHING previene duplicados si se ejecuta múltiples veces
INSERT INTO public.categories (
  entity_type,
  name,
  display_name,
  is_system,
  is_active,
  display_order,
  clinic_id
) VALUES
  -- Categorías principales de gastos
  ('expense', 'materials', 'Materiales', true, true, 1, NULL),
  ('expense', 'services', 'Servicios', true, true, 2, NULL),
  ('expense', 'rent', 'Alquiler', true, true, 3, NULL),
  ('expense', 'utilities', 'Servicios Públicos', true, true, 4, NULL),
  ('expense', 'salaries', 'Salarios', true, true, 5, NULL),
  ('expense', 'marketing', 'Marketing', true, true, 6, NULL),
  ('expense', 'insurance', 'Seguros', true, true, 7, NULL),
  ('expense', 'maintenance', 'Mantenimiento', true, true, 8, NULL),
  ('expense', 'supplies', 'Insumos', true, true, 9, NULL),
  ('expense', 'otros', 'Otros', true, true, 99, NULL)
ON CONFLICT DO NOTHING;

-- Verificar que se insertaron correctamente
DO $$
DECLARE
  expense_categories_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO expense_categories_count
  FROM public.categories
  WHERE entity_type = 'expense'
    AND is_system = true;

  RAISE NOTICE '✓ Categorías de expenses del sistema creadas: %', expense_categories_count;

  IF expense_categories_count < 10 THEN
    RAISE WARNING 'Se esperaban al menos 10 categorías, pero se encontraron %', expense_categories_count;
  END IF;
END $$;

-- Listar todas las categorías de expenses del sistema
SELECT
  name,
  display_name,
  display_order,
  CASE
    WHEN is_system THEN 'Sistema'
    ELSE 'Custom'
  END as tipo
FROM public.categories
WHERE entity_type = 'expense'
ORDER BY display_order;
