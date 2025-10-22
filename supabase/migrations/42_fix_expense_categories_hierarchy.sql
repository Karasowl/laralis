-- ============================================================================
-- Migration 42: Corregir categorías de gastos con jerarquía
-- Descripción: Reemplaza categorías de migración 37 con estructura correcta
--              y jerarquía parent/child para subcategorías
-- Fecha: 2025-10-21
-- Relacionado: Fix para CreateExpenseForm.tsx subcategory filtering
-- ============================================================================

-- PASO 1: NO eliminar categorías viejas todavía (tienen FK de expenses)
-- Las eliminaremos al final después de migrar los gastos
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Paso 1: Categorías viejas se eliminarán después de migrar gastos';
END $$;

-- PASO 2: Crear categorías PADRE (principales)
-- ============================================================================
DO $$
DECLARE
  cat_equipos_id UUID;
  cat_insumos_id UUID;
  cat_servicios_id UUID;
  cat_mantenimiento_id UUID;
  cat_marketing_id UUID;
  cat_administrativos_id UUID;
  cat_personal_id UUID;
  cat_otros_id UUID;
BEGIN
  -- Equipos
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'equipos', 'Equipos', true, true, 1, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_equipos_id;

  IF cat_equipos_id IS NULL THEN
    SELECT id INTO cat_equipos_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'equipos' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  -- Insumos
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'insumos', 'Insumos', true, true, 2, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_insumos_id;

  IF cat_insumos_id IS NULL THEN
    SELECT id INTO cat_insumos_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'insumos' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  -- Servicios
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'servicios', 'Servicios', true, true, 3, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_servicios_id;

  IF cat_servicios_id IS NULL THEN
    SELECT id INTO cat_servicios_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'servicios' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  -- Mantenimiento
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'mantenimiento', 'Mantenimiento', true, true, 4, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_mantenimiento_id;

  IF cat_mantenimiento_id IS NULL THEN
    SELECT id INTO cat_mantenimiento_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'mantenimiento' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  -- Marketing
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'marketing', 'Marketing', true, true, 5, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_marketing_id;

  IF cat_marketing_id IS NULL THEN
    SELECT id INTO cat_marketing_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'marketing' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  -- Administrativos
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'administrativos', 'Administrativos', true, true, 6, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_administrativos_id;

  IF cat_administrativos_id IS NULL THEN
    SELECT id INTO cat_administrativos_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'administrativos' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  -- Personal
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'personal', 'Personal', true, true, 7, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_personal_id;

  IF cat_personal_id IS NULL THEN
    SELECT id INTO cat_personal_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'personal' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  -- Otros
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id)
  VALUES ('expense', 'otros', 'Otros', true, true, 99, NULL, NULL)
  ON CONFLICT DO NOTHING
  RETURNING id INTO cat_otros_id;

  IF cat_otros_id IS NULL THEN
    SELECT id INTO cat_otros_id FROM public.categories
    WHERE entity_type = 'expense' AND name = 'otros' AND is_system = true AND clinic_id IS NULL LIMIT 1;
  END IF;

  RAISE NOTICE '✓ Categorías padre creadas';

  -- PASO 3: Crear SUBCATEGORÍAS (hijas) con parent_id
  -- ============================================================================

  -- Subcategorías de EQUIPOS
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id) VALUES
    ('expense', 'dental', 'Dental', true, true, 1, NULL, cat_equipos_id),
    ('expense', 'mobiliario', 'Mobiliario', true, true, 2, NULL, cat_equipos_id),
    ('expense', 'tecnologia', 'Tecnología', true, true, 3, NULL, cat_equipos_id),
    ('expense', 'herramientas', 'Herramientas', true, true, 4, NULL, cat_equipos_id)
  ON CONFLICT DO NOTHING;

  -- Subcategorías de INSUMOS
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id) VALUES
    ('expense', 'anestesia', 'Anestesia', true, true, 1, NULL, cat_insumos_id),
    ('expense', 'materiales', 'Materiales', true, true, 2, NULL, cat_insumos_id),
    ('expense', 'limpieza', 'Limpieza', true, true, 3, NULL, cat_insumos_id),
    ('expense', 'proteccion', 'Protección', true, true, 4, NULL, cat_insumos_id)
  ON CONFLICT DO NOTHING;

  -- Subcategorías de SERVICIOS
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id) VALUES
    ('expense', 'electricidad', 'Electricidad', true, true, 1, NULL, cat_servicios_id),
    ('expense', 'agua', 'Agua', true, true, 2, NULL, cat_servicios_id),
    ('expense', 'internet', 'Internet', true, true, 3, NULL, cat_servicios_id),
    ('expense', 'telefono', 'Teléfono', true, true, 4, NULL, cat_servicios_id),
    ('expense', 'gas', 'Gas', true, true, 5, NULL, cat_servicios_id)
  ON CONFLICT DO NOTHING;

  -- Subcategorías de MANTENIMIENTO
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id) VALUES
    ('expense', 'equipos_mant', 'Equipos', true, true, 1, NULL, cat_mantenimiento_id),
    ('expense', 'instalaciones', 'Instalaciones', true, true, 2, NULL, cat_mantenimiento_id),
    ('expense', 'software', 'Software', true, true, 3, NULL, cat_mantenimiento_id)
  ON CONFLICT DO NOTHING;

  -- Subcategorías de MARKETING
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id) VALUES
    ('expense', 'publicidad', 'Publicidad', true, true, 1, NULL, cat_marketing_id),
    ('expense', 'promociones', 'Promociones', true, true, 2, NULL, cat_marketing_id),
    ('expense', 'eventos', 'Eventos', true, true, 3, NULL, cat_marketing_id)
  ON CONFLICT DO NOTHING;

  -- Subcategorías de ADMINISTRATIVOS
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id) VALUES
    ('expense', 'papeleria', 'Papelería', true, true, 1, NULL, cat_administrativos_id),
    ('expense', 'contabilidad', 'Contabilidad', true, true, 2, NULL, cat_administrativos_id),
    ('expense', 'legal', 'Legal', true, true, 3, NULL, cat_administrativos_id)
  ON CONFLICT DO NOTHING;

  -- Subcategorías de PERSONAL
  INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order, clinic_id, parent_id) VALUES
    ('expense', 'nomina', 'Nómina', true, true, 1, NULL, cat_personal_id),
    ('expense', 'beneficios', 'Beneficios', true, true, 2, NULL, cat_personal_id),
    ('expense', 'capacitacion', 'Capacitación', true, true, 3, NULL, cat_personal_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✓ Subcategorías creadas';

END $$;

-- PASO 4: Migrar gastos existentes que usan category (string) antigua
-- ============================================================================
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  -- Mapear valores antiguos de category (string) a nuevas categorías
  UPDATE public.expenses e
  SET category_id = (
    SELECT c.id
    FROM public.categories c
    WHERE c.entity_type = 'expense'
      AND c.is_system = true
      AND c.clinic_id IS NULL
      AND c.parent_id IS NULL  -- Solo categorías padre
      AND (
        LOWER(TRIM(c.name)) = LOWER(TRIM(e.category))
        OR LOWER(TRIM(c.display_name)) = LOWER(TRIM(e.category))
        -- Mapeos especiales para nombres antiguos
        OR (LOWER(TRIM(e.category)) IN ('materials', 'materiales') AND c.name = 'insumos')
        OR (LOWER(TRIM(e.category)) IN ('services') AND c.name = 'servicios')
        OR (LOWER(TRIM(e.category)) IN ('salaries', 'salarios') AND c.name = 'personal')
        OR (LOWER(TRIM(e.category)) IN ('maintenance') AND c.name = 'mantenimiento')
        OR (LOWER(TRIM(e.category)) IN ('insurance', 'seguros') AND c.name = 'otros')
      )
    LIMIT 1
  )
  WHERE e.category IS NOT NULL
    AND TRIM(e.category) != ''
    AND (
      e.category_id IS NULL
      OR e.category_id NOT IN (
        SELECT id FROM public.categories
        WHERE entity_type = 'expense' AND is_system = true AND clinic_id IS NULL
      )
    );

  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE '✓ Gastos migrados a nuevas categorías: %', migrated_count;
END $$;

-- PASO 5: Asignar "Otros" a gastos sin categoría válida
-- ============================================================================
DO $$
DECLARE
  otros_id UUID;
  fixed_count INTEGER;
BEGIN
  SELECT id INTO otros_id
  FROM public.categories
  WHERE entity_type = 'expense'
    AND is_system = true
    AND name = 'otros'
    AND clinic_id IS NULL
    AND parent_id IS NULL
  LIMIT 1;

  IF otros_id IS NULL THEN
    RAISE EXCEPTION 'ERROR: No se encontró la categoría "Otros"';
  END IF;

  UPDATE public.expenses
  SET category_id = otros_id
  WHERE category_id IS NULL;

  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE '✓ Gastos asignados a "Otros": %', fixed_count;
END $$;

-- PASO 6: Asegurar que category_id sea NOT NULL
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'category_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.expenses ALTER COLUMN category_id SET NOT NULL;
    RAISE NOTICE '✓ Columna category_id configurada como NOT NULL';
  ELSE
    RAISE NOTICE '✓ Columna category_id ya es NOT NULL';
  END IF;
END $$;

-- PASO 6B: Ahora sí eliminar categorías viejas (ya no tienen referencias)
-- ============================================================================
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar categorías viejas de migración 37 que ya no se usan
  DELETE FROM public.categories
  WHERE entity_type = 'expense'
    AND is_system = true
    AND clinic_id IS NULL
    AND name IN ('materials', 'services', 'rent', 'utilities', 'salaries',
                 'insurance', 'maintenance', 'supplies')
    -- NO eliminamos 'marketing' ni 'otros' porque pueden coincidir con las nuevas
    AND id NOT IN (
      -- No eliminar categorías que todavía están en uso
      SELECT DISTINCT category_id
      FROM public.expenses
      WHERE category_id IS NOT NULL
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✓ Categorías viejas eliminadas: %', deleted_count;
END $$;

-- PASO 7: Crear índice para performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_expenses_category_id
ON public.expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id
ON public.categories(parent_id)
WHERE parent_id IS NOT NULL;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
  total_categories INTEGER;
  total_parent_categories INTEGER;
  total_subcategories INTEGER;
  total_expenses INTEGER;
  expenses_with_category INTEGER;
BEGIN
  -- Contar categorías
  SELECT COUNT(*) INTO total_categories
  FROM public.categories
  WHERE entity_type = 'expense' AND is_system = true AND clinic_id IS NULL;

  SELECT COUNT(*) INTO total_parent_categories
  FROM public.categories
  WHERE entity_type = 'expense' AND is_system = true AND clinic_id IS NULL AND parent_id IS NULL;

  SELECT COUNT(*) INTO total_subcategories
  FROM public.categories
  WHERE entity_type = 'expense' AND is_system = true AND clinic_id IS NULL AND parent_id IS NOT NULL;

  -- Contar gastos
  SELECT COUNT(*) INTO total_expenses FROM public.expenses;
  SELECT COUNT(*) INTO expenses_with_category FROM public.expenses WHERE category_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN DE MIGRACIÓN 42:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Categorías padre creadas: %', total_parent_categories;
  RAISE NOTICE 'Subcategorías creadas: %', total_subcategories;
  RAISE NOTICE 'Total de categorías: %', total_categories;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Total de gastos: %', total_expenses;
  RAISE NOTICE 'Gastos con categoría: %', expenses_with_category;
  RAISE NOTICE '========================================';

  IF total_parent_categories < 8 THEN
    RAISE WARNING 'Se esperaban 8 categorías padre, se encontraron %', total_parent_categories;
  END IF;

  IF total_subcategories < 23 THEN
    RAISE WARNING 'Se esperaban 23 subcategorías, se encontraron %', total_subcategories;
  END IF;

  IF expenses_with_category < total_expenses THEN
    RAISE WARNING '% gastos sin categoría!', (total_expenses - expenses_with_category);
  ELSE
    RAISE NOTICE '✓ MIGRACIÓN EXITOSA: Todos los gastos tienen categoría';
  END IF;
END $$;

-- Mostrar jerarquía de categorías creadas
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
