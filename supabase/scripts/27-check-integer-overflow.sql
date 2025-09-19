-- ================================================================
-- Script de Verificación: Detectar Posibles Overflows de Integer
-- ================================================================
-- Este script verifica si hay valores que podrían causar overflow
-- en campos INTEGER antes de la migración a BIGINT
-- ================================================================

-- Límite máximo de INTEGER en PostgreSQL: 2,147,483,647

-- 1. Verificar fixed_costs
SELECT
    'fixed_costs' as tabla,
    COUNT(*) as registros_afectados,
    MAX(amount_cents) as valor_maximo,
    CASE
        WHEN MAX(amount_cents) > 2147483647 THEN 'OVERFLOW DETECTADO'
        WHEN MAX(amount_cents) > 1500000000 THEN 'CERCANO AL LÍMITE (>70%)'
        ELSE 'OK'
    END as estado
FROM public.fixed_costs
WHERE amount_cents IS NOT NULL;

-- 2. Verificar supplies
SELECT
    'supplies' as tabla,
    COUNT(*) as registros_afectados,
    MAX(price_cents) as valor_maximo,
    CASE
        WHEN MAX(price_cents) > 2147483647 THEN 'OVERFLOW DETECTADO'
        WHEN MAX(price_cents) > 1500000000 THEN 'CERCANO AL LÍMITE (>70%)'
        ELSE 'OK'
    END as estado
FROM public.supplies
WHERE price_cents IS NOT NULL;

-- 3. Verificar services
SELECT
    'services' as tabla,
    'price_cents' as campo,
    COUNT(*) as registros,
    MAX(price_cents) as valor_maximo,
    CASE
        WHEN MAX(price_cents) > 2147483647 THEN 'OVERFLOW DETECTADO'
        WHEN MAX(price_cents) > 1500000000 THEN 'CERCANO AL LÍMITE (>70%)'
        ELSE 'OK'
    END as estado
FROM public.services
WHERE price_cents IS NOT NULL
UNION ALL
SELECT
    'services' as tabla,
    'variable_cost_cents' as campo,
    COUNT(*) as registros,
    MAX(variable_cost_cents) as valor_maximo,
    CASE
        WHEN MAX(variable_cost_cents) > 2147483647 THEN 'OVERFLOW DETECTADO'
        WHEN MAX(variable_cost_cents) > 1500000000 THEN 'CERCANO AL LÍMITE (>70%)'
        ELSE 'OK'
    END as estado
FROM public.services
WHERE variable_cost_cents IS NOT NULL;

-- 4. Verificar expenses
SELECT
    'expenses' as tabla,
    COUNT(*) as registros_afectados,
    MAX(amount_cents) as valor_maximo,
    CASE
        WHEN MAX(amount_cents) > 2147483647 THEN 'OVERFLOW DETECTADO'
        WHEN MAX(amount_cents) > 1500000000 THEN 'CERCANO AL LÍMITE (>70%)'
        ELSE 'OK'
    END as estado
FROM public.expenses
WHERE amount_cents IS NOT NULL;

-- 5. Verificar assets
SELECT
    'assets' as tabla,
    COUNT(*) as registros_afectados,
    MAX(purchase_price_cents) as valor_maximo,
    CASE
        WHEN MAX(purchase_price_cents) > 2147483647 THEN 'OVERFLOW DETECTADO'
        WHEN MAX(purchase_price_cents) > 1500000000 THEN 'CERCANO AL LÍMITE (>70%)'
        ELSE 'OK'
    END as estado
FROM public.assets
WHERE purchase_price_cents IS NOT NULL;

-- 6. Verificar treatments
SELECT
    'treatments' as tabla,
    COUNT(*) as registros_afectados,
    MAX(price_cents) as valor_maximo,
    CASE
        WHEN MAX(price_cents) > 2147483647 THEN 'OVERFLOW DETECTADO'
        WHEN MAX(price_cents) > 1500000000 THEN 'CERCANO AL LÍMITE (>70%)'
        ELSE 'OK'
    END as estado
FROM public.treatments
WHERE price_cents IS NOT NULL;

-- 7. Listar registros específicos con valores problemáticos en fixed_costs
SELECT
    id,
    clinic_id,
    category,
    concept,
    amount_cents,
    amount_cents / 100.0 as amount_pesos,
    created_at
FROM public.fixed_costs
WHERE amount_cents > 1000000000 -- Más de $10,000,000 pesos
ORDER BY amount_cents DESC
LIMIT 10;

-- 8. Verificar el tipo de dato actual de las columnas
SELECT
    table_name,
    column_name,
    data_type,
    numeric_precision,
    CASE
        WHEN data_type = 'integer' THEN '2,147,483,647'
        WHEN data_type = 'bigint' THEN '9,223,372,036,854,775,807'
        ELSE 'N/A'
    END as max_value
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name LIKE '%_cents'
ORDER BY table_name, column_name;