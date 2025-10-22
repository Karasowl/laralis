-- ============================================================================
-- Script: Limpiar categorías duplicadas de gastos
-- Propósito: Eliminar duplicados dejando solo las categorías correctas
-- ============================================================================

-- PASO 1: Ver las categorías duplicadas
SELECT
  name,
  display_name,
  id,
  created_at,
  (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = cat.id) as tiene_subcategorias,
  (SELECT COUNT(*) FROM expenses WHERE category_id = cat.id) as gastos_usando
FROM categories cat
WHERE entity_type = 'expense'
  AND is_system = true
  AND clinic_id IS NULL
  AND name IN (
    -- Encontrar nombres duplicados
    SELECT name
    FROM categories
    WHERE entity_type = 'expense'
      AND is_system = true
      AND clinic_id IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  )
ORDER BY name, created_at DESC;

-- PASO 2: Limpiar duplicados
-- Para cada nombre duplicado, mantener la que:
--   1. Tiene subcategorías, O
--   2. Es la más reciente (created_at más nuevo)
-- ============================================================================
DO $$
DECLARE
  duplicate_name TEXT;
  correct_id UUID;
  duplicate_ids UUID[];
  migrated_count INTEGER := 0;
  deleted_count INTEGER := 0;
BEGIN
  -- Iterar sobre cada nombre duplicado
  FOR duplicate_name IN
    SELECT name
    FROM categories
    WHERE entity_type = 'expense'
      AND is_system = true
      AND clinic_id IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Procesando duplicados de: %', duplicate_name;

    -- Encontrar la categoría correcta (la que tiene subcategorías o la más reciente)
    SELECT id INTO correct_id
    FROM categories
    WHERE entity_type = 'expense'
      AND is_system = true
      AND clinic_id IS NULL
      AND name = duplicate_name
    ORDER BY
      -- Priorizar la que tiene subcategorías
      (SELECT COUNT(*) FROM categories sub WHERE sub.parent_id = categories.id) DESC,
      -- Si ninguna tiene subcategorías, la más reciente
      created_at DESC
    LIMIT 1;

    -- Obtener IDs de los duplicados
    SELECT array_agg(id) INTO duplicate_ids
    FROM categories
    WHERE entity_type = 'expense'
      AND is_system = true
      AND clinic_id IS NULL
      AND name = duplicate_name
      AND id != correct_id;

    IF array_length(duplicate_ids, 1) > 0 THEN
      RAISE NOTICE '  Categoría correcta: % (ID: %)', duplicate_name, correct_id;
      RAISE NOTICE '  Duplicados a eliminar: %', duplicate_ids;

      -- Migrar gastos de duplicados a la correcta
      UPDATE expenses
      SET category_id = correct_id
      WHERE category_id = ANY(duplicate_ids);

      GET DIAGNOSTICS migrated_count = ROW_COUNT;
      RAISE NOTICE '  Gastos migrados: %', migrated_count;

      -- Eliminar duplicados
      DELETE FROM categories
      WHERE id = ANY(duplicate_ids);

      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE '  Categorías duplicadas eliminadas: %', deleted_count;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Limpieza completada';
  RAISE NOTICE '========================================';
END $$;

-- PASO 3: Verificar que no queden duplicados
SELECT
  name,
  COUNT(*) as total,
  array_agg(id) as ids
FROM categories
WHERE entity_type = 'expense'
  AND is_system = true
  AND clinic_id IS NULL
GROUP BY name
HAVING COUNT(*) > 1;
-- Si esta query no retorna filas, ya no hay duplicados ✓

-- PASO 4: Mostrar jerarquía final limpia
SELECT
  COALESCE(parent.display_name, cat.display_name) AS categoria_padre,
  CASE WHEN cat.parent_id IS NOT NULL THEN '  └─ ' || cat.display_name ELSE '' END AS subcategoria,
  cat.display_order
FROM public.categories cat
LEFT JOIN public.categories parent ON cat.parent_id = parent.id
WHERE cat.entity_type = 'expense'
  AND cat.is_system = true
  AND cat.clinic_id IS NULL
ORDER BY
  COALESCE(parent.display_order, cat.display_order),
  parent.id NULLS FIRST,
  cat.display_order;
