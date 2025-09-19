-- ================================================================
-- ROLLBACK Script: Revertir de BIGINT a INTEGER
-- ================================================================
-- ADVERTENCIA: Solo usar si hay problemas con la migración a BIGINT
-- Este script puede fallar si hay valores que exceden el límite INTEGER
-- ================================================================

-- ANTES DE EJECUTAR: Verificar que no hay valores > 2,147,483,647
DO $$
DECLARE
    v_max_value BIGINT;
    v_table_name TEXT;
    v_column_name TEXT;
BEGIN
    -- Verificar fixed_costs
    SELECT MAX(amount_cents) INTO v_max_value FROM public.fixed_costs;
    IF v_max_value > 2147483647 THEN
        RAISE EXCEPTION 'Cannot rollback: fixed_costs.amount_cents has values > INTEGER limit (%)' , v_max_value;
    END IF;

    -- Verificar supplies
    SELECT MAX(price_cents) INTO v_max_value FROM public.supplies;
    IF v_max_value > 2147483647 THEN
        RAISE EXCEPTION 'Cannot rollback: supplies.price_cents has values > INTEGER limit (%)' , v_max_value;
    END IF;

    -- Verificar services
    SELECT GREATEST(
        MAX(fixed_cost_per_minute_cents),
        MAX(variable_cost_cents),
        MAX(price_cents)
    ) INTO v_max_value FROM public.services;
    IF v_max_value > 2147483647 THEN
        RAISE EXCEPTION 'Cannot rollback: services has values > INTEGER limit (%)' , v_max_value;
    END IF;

    -- Verificar expenses
    SELECT MAX(amount_cents) INTO v_max_value FROM public.expenses;
    IF v_max_value > 2147483647 THEN
        RAISE EXCEPTION 'Cannot rollback: expenses.amount_cents has values > INTEGER limit (%)' , v_max_value;
    END IF;

    -- Verificar assets
    SELECT GREATEST(
        MAX(purchase_price_cents),
        MAX(COALESCE(disposal_value_cents, 0))
    ) INTO v_max_value FROM public.assets;
    IF v_max_value > 2147483647 THEN
        RAISE EXCEPTION 'Cannot rollback: assets has values > INTEGER limit (%)' , v_max_value;
    END IF;

    -- Verificar treatments
    SELECT GREATEST(
        MAX(fixed_cost_per_minute_cents),
        MAX(variable_cost_cents),
        MAX(price_cents)
    ) INTO v_max_value FROM public.treatments;
    IF v_max_value > 2147483647 THEN
        RAISE EXCEPTION 'Cannot rollback: treatments has values > INTEGER limit (%)' , v_max_value;
    END IF;

    -- Verificar tariffs
    SELECT GREATEST(
        MAX(fixed_cost_per_minute_cents),
        MAX(variable_cost_cents),
        MAX(price_cents),
        MAX(rounded_price_cents)
    ) INTO v_max_value FROM public.tariffs;
    IF v_max_value > 2147483647 THEN
        RAISE EXCEPTION 'Cannot rollback: tariffs has values > INTEGER limit (%)' , v_max_value;
    END IF;

    RAISE NOTICE 'All values are within INTEGER range. Safe to proceed with rollback.';
END $$;

-- SI LAS VERIFICACIONES PASAN, PROCEDER CON EL ROLLBACK:

-- 1. FIXED_COSTS TABLE
ALTER TABLE public.fixed_costs
ALTER COLUMN amount_cents TYPE INTEGER;

-- 2. SUPPLIES TABLE
ALTER TABLE public.supplies
ALTER COLUMN price_cents TYPE INTEGER;

-- 3. SERVICES TABLE
ALTER TABLE public.services
ALTER COLUMN fixed_cost_per_minute_cents TYPE INTEGER,
ALTER COLUMN variable_cost_cents TYPE INTEGER,
ALTER COLUMN price_cents TYPE INTEGER;

-- 4. TREATMENTS TABLE
ALTER TABLE public.treatments
ALTER COLUMN fixed_cost_per_minute_cents TYPE INTEGER,
ALTER COLUMN variable_cost_cents TYPE INTEGER,
ALTER COLUMN price_cents TYPE INTEGER;

-- 5. EXPENSES TABLE
ALTER TABLE public.expenses
ALTER COLUMN amount_cents TYPE INTEGER;

-- 6. ASSETS TABLE - Primero eliminar la columna generada
ALTER TABLE public.assets
DROP COLUMN IF EXISTS monthly_depreciation_cents;

-- Luego cambiar los tipos
ALTER TABLE public.assets
ALTER COLUMN purchase_price_cents TYPE INTEGER,
ALTER COLUMN disposal_value_cents TYPE INTEGER;

-- Recrear la columna generada con INTEGER
ALTER TABLE public.assets
ADD COLUMN monthly_depreciation_cents INTEGER
GENERATED ALWAYS AS (
    CASE
        WHEN depreciation_years IS NOT NULL AND depreciation_years > 0
        THEN purchase_price_cents / (depreciation_years * 12)
        ELSE NULL
    END
) STORED;

-- 7. TARIFFS TABLE
ALTER TABLE public.tariffs
ALTER COLUMN fixed_cost_per_minute_cents TYPE INTEGER,
ALTER COLUMN variable_cost_cents TYPE INTEGER,
ALTER COLUMN price_cents TYPE INTEGER,
ALTER COLUMN rounded_price_cents TYPE INTEGER;

-- 8. MARKETING_CAMPAIGNS TABLE (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = 'marketing_campaigns'
               AND column_name = 'budget_cents') THEN
        ALTER TABLE public.marketing_campaigns
        ALTER COLUMN budget_cents TYPE INTEGER;
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = 'marketing_campaigns'
               AND column_name = 'spent_cents') THEN
        ALTER TABLE public.marketing_campaigns
        ALTER COLUMN spent_cents TYPE INTEGER;
    END IF;
END $$;

-- 9. Eliminar comentarios
COMMENT ON COLUMN public.fixed_costs.amount_cents IS NULL;
COMMENT ON COLUMN public.supplies.price_cents IS NULL;
COMMENT ON COLUMN public.services.price_cents IS NULL;
COMMENT ON COLUMN public.treatments.price_cents IS NULL;
COMMENT ON COLUMN public.expenses.amount_cents IS NULL;
COMMENT ON COLUMN public.assets.purchase_price_cents IS NULL;

-- 10. Verificar el rollback
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name LIKE '%_cents'
    AND data_type = 'bigint';

    IF v_count > 0 THEN
        RAISE NOTICE 'Warning: % columns ending in _cents still use BIGINT type', v_count;
    ELSE
        RAISE NOTICE 'Success: All monetary columns have been reverted to INTEGER';
    END IF;
END $$;