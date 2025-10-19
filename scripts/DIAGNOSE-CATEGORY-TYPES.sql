-- =================================================================
-- DIAGNÓSTICO: ¿Por qué category_type_id es NULL?
-- =================================================================

-- PASO 1: Verificar QUÉ HAY en category_types
SELECT
    '====== CONTENIDO DE category_types ======' as diagnostico;

SELECT
    id,
    name,
    display_name,
    created_at
FROM category_types
ORDER BY name;

-- PASO 2: Verificar si puedo hacer SELECT como lo haría el trigger
DO $$
DECLARE
    v_service_id UUID;
    v_supply_id UUID;
    v_fixed_cost_id UUID;
    v_count INT;
BEGIN
    -- Contar cuántos hay
    SELECT COUNT(*) INTO v_count FROM category_types;
    RAISE NOTICE 'Total de registros en category_types: %', v_count;

    -- Intentar SELECT como lo hace el trigger
    SELECT id INTO v_service_id FROM category_types WHERE name = 'service';
    SELECT id INTO v_supply_id FROM category_types WHERE name = 'supply';
    SELECT id INTO v_fixed_cost_id FROM category_types WHERE name = 'fixed_cost';

    -- Mostrar resultados
    IF v_service_id IS NULL THEN
        RAISE WARNING '❌ service_type_id es NULL - NO se puede leer "service"';
    ELSE
        RAISE NOTICE '✅ service_type_id encontrado: %', v_service_id;
    END IF;

    IF v_supply_id IS NULL THEN
        RAISE WARNING '❌ supply_type_id es NULL - NO se puede leer "supply"';
    ELSE
        RAISE NOTICE '✅ supply_type_id encontrado: %', v_supply_id;
    END IF;

    IF v_fixed_cost_id IS NULL THEN
        RAISE WARNING '❌ fixed_cost_type_id es NULL - NO se puede leer "fixed_cost"';
    ELSE
        RAISE NOTICE '✅ fixed_cost_type_id encontrado: %', v_fixed_cost_id;
    END IF;
END $$;

-- PASO 3: Verificar la función del trigger
SELECT
    '====== FUNCIÓN insert_default_categories ======' as diagnostico;

SELECT
    proname as nombre_funcion,
    prosecdef as es_security_definer,
    CASE
        WHEN prosecdef THEN '✅ SECURITY DEFINER (ejecuta como owner)'
        ELSE '❌ SECURITY INVOKER (ejecuta como usuario - PROBLEMA)'
    END as tipo_seguridad
FROM pg_proc
WHERE proname = 'insert_default_categories';

-- PASO 4: Mostrar el código de la función
SELECT pg_get_functiondef('insert_default_categories()'::regprocedure);
