-- ================================================================
-- Migration: Fix Integer Overflow by Converting to BIGINT
-- ================================================================
-- Problem: INTEGER fields for monetary values can overflow
-- Max INTEGER: 2,147,483,647 (about $21,474,836.47 in cents)
-- Solution: Convert all monetary INTEGER fields to BIGINT
-- Max BIGINT: 9,223,372,036,854,775,807 (practically unlimited)
-- ================================================================

-- 1. FIXED_COSTS TABLE
-- Current amount_cents: INTEGER
ALTER TABLE public.fixed_costs
ALTER COLUMN amount_cents TYPE BIGINT;

-- 2. SUPPLIES TABLE
-- Current price_cents: INTEGER
ALTER TABLE public.supplies
ALTER COLUMN price_cents TYPE BIGINT;

-- 3. SERVICES TABLE
-- Multiple monetary columns
ALTER TABLE public.services
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT;

-- 4. TREATMENTS TABLE
-- Snapshot costs and prices
ALTER TABLE public.treatments
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT;

-- 5. EXPENSES TABLE
-- Amount for expenses
ALTER TABLE public.expenses
ALTER COLUMN amount_cents TYPE BIGINT;

-- 6. ASSETS TABLE
-- Purchase price and depreciation
ALTER TABLE public.assets
ALTER COLUMN purchase_price_cents TYPE BIGINT,
ALTER COLUMN monthly_depreciation_cents TYPE BIGINT,
ALTER COLUMN disposal_value_cents TYPE BIGINT;

-- 7. TARIFFS TABLE
-- All pricing columns
ALTER TABLE public.tariffs
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT,
ALTER COLUMN rounded_price_cents TYPE BIGINT;

-- 8. MARKETING_CAMPAIGNS TABLE (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = 'marketing_campaigns'
               AND column_name = 'budget_cents') THEN
        ALTER TABLE public.marketing_campaigns
        ALTER COLUMN budget_cents TYPE BIGINT;
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = 'marketing_campaigns'
               AND column_name = 'spent_cents') THEN
        ALTER TABLE public.marketing_campaigns
        ALTER COLUMN spent_cents TYPE BIGINT;
    END IF;
END $$;

-- 9. Update any CHECK constraints that might reference specific integer ranges
-- Fixed costs constraint should work with BIGINT (amount_cents >= 0)
-- No changes needed as >= 0 works for BIGINT too

-- 10. Recreate the monthly_depreciation_cents GENERATED column with BIGINT arithmetic
-- First drop the generated column
ALTER TABLE public.assets
DROP COLUMN IF EXISTS monthly_depreciation_cents;

-- Then recreate it with proper BIGINT handling
ALTER TABLE public.assets
ADD COLUMN monthly_depreciation_cents BIGINT
GENERATED ALWAYS AS (
    CASE
        WHEN depreciation_years IS NOT NULL AND depreciation_years > 0
        THEN purchase_price_cents / (depreciation_years * 12)
        ELSE NULL
    END
) STORED;

-- 11. Add comment explaining the migration
COMMENT ON COLUMN public.fixed_costs.amount_cents IS 'Amount in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.supplies.price_cents IS 'Price in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.services.price_cents IS 'Service price in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.treatments.price_cents IS 'Treatment price in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.expenses.amount_cents IS 'Expense amount in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.assets.purchase_price_cents IS 'Purchase price in cents (BIGINT to prevent overflow)';

-- 12. Verify the changes
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check that all monetary columns are now BIGINT
    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name LIKE '%_cents'
    AND data_type = 'integer';

    IF v_count > 0 THEN
        RAISE NOTICE 'Warning: % columns ending in _cents still use INTEGER type', v_count;
    ELSE
        RAISE NOTICE 'Success: All monetary columns have been converted to BIGINT';
    END IF;
END $$;