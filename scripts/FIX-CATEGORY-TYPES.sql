-- =================================================================
-- FIX: Poblar category_types (tabla faltante)
-- =================================================================
-- El trigger insert_default_categories() necesita que category_types
-- tenga los registros básicos: 'service', 'supply', 'fixed_cost', 'expense'
-- =================================================================

-- PASO 1: Verificar si category_types existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'category_types') THEN
        RAISE EXCEPTION '❌ CRÍTICO: Tabla category_types NO EXISTE';
    ELSE
        RAISE NOTICE '✅ Tabla category_types existe';
    END IF;
END $$;

-- PASO 2: Ver qué hay actualmente en category_types
SELECT
    'CONTENIDO ACTUAL DE category_types:' as info,
    COUNT(*) as total_registros
FROM category_types;

SELECT * FROM category_types;

-- PASO 3: Insertar los tipos básicos necesarios
INSERT INTO category_types (name, display_name) VALUES
  ('service', 'Categorías de Servicios'),
  ('supply', 'Categorías de Insumos'),
  ('fixed_cost', 'Categorías de Costos Fijos'),
  ('expense', 'Categorías de Gastos')
ON CONFLICT (name) DO NOTHING;

-- PASO 4: Verificar que se insertaron correctamente
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM category_types WHERE name IN ('service', 'supply', 'fixed_cost', 'expense');

    IF v_count >= 4 THEN
        RAISE NOTICE '✅ category_types poblada correctamente con % registros', v_count;
    ELSE
        RAISE WARNING '⚠️ category_types solo tiene % registros (esperado: 4)', v_count;
    END IF;
END $$;

-- PASO 5: Mostrar todos los tipos
SELECT
    'TIPOS DISPONIBLES:' as info,
    id,
    name,
    display_name
FROM category_types
ORDER BY name;

-- PASO 6: Mensaje final
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FIX COMPLETADO';
    RAISE NOTICE 'category_types ahora tiene los datos necesarios';
    RAISE NOTICE 'El trigger insert_default_categories() debería funcionar';
    RAISE NOTICE '========================================';
END $$;
