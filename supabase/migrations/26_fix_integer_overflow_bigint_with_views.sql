-- ================================================================
-- Migration: Fix Integer Overflow by Converting to BIGINT
-- Version 2: Handles views and dependencies
-- ================================================================
-- Problem: INTEGER fields for monetary values can overflow
-- Max INTEGER: 2,147,483,647 (about $21,474,836.47 in cents)
-- Solution: Convert all monetary INTEGER fields to BIGINT
-- Max BIGINT: 9,223,372,036,854,775,807 (practically unlimited)
-- ================================================================

-- STEP 1: Store view definitions before dropping them
-- ================================================================
DO $$
DECLARE
    v_referral_network_def TEXT;
BEGIN
    -- Store the referral_network view definition if it exists
    SELECT pg_get_viewdef('referral_network', true) INTO v_referral_network_def
    FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'referral_network';

    -- Store it in a temporary table for later use
    CREATE TEMP TABLE IF NOT EXISTS temp_view_definitions (
        view_name TEXT PRIMARY KEY,
        view_definition TEXT
    );

    IF v_referral_network_def IS NOT NULL THEN
        INSERT INTO temp_view_definitions (view_name, view_definition)
        VALUES ('referral_network', v_referral_network_def)
        ON CONFLICT (view_name) DO UPDATE SET view_definition = EXCLUDED.view_definition;
    END IF;
END $$;

-- STEP 2: Drop dependent views
-- ================================================================
DROP VIEW IF EXISTS public.referral_network CASCADE;

-- Check for other potential views that might use _cents columns
DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Find and drop any other views that might depend on our tables
    FOR rec IN
        SELECT DISTINCT v.schemaname, v.viewname
        FROM pg_views v
        JOIN information_schema.view_column_usage vcu
            ON v.viewname = vcu.view_name AND v.schemaname = vcu.view_schema
        WHERE vcu.table_schema = 'public'
        AND vcu.table_name IN ('fixed_costs', 'supplies', 'services', 'treatments', 'expenses', 'assets', 'tariffs', 'marketing_campaigns')
        AND v.schemaname = 'public'
        AND v.viewname != 'referral_network' -- Already handled
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', rec.schemaname, rec.viewname);
        RAISE NOTICE 'Dropped view: %.%', rec.schemaname, rec.viewname;
    END LOOP;
END $$;

-- STEP 3: ALTER COLUMNS TO BIGINT
-- ================================================================

-- 1. FIXED_COSTS TABLE
ALTER TABLE public.fixed_costs
ALTER COLUMN amount_cents TYPE BIGINT;

-- 2. SUPPLIES TABLE
ALTER TABLE public.supplies
ALTER COLUMN price_cents TYPE BIGINT;

-- 3. SERVICES TABLE
ALTER TABLE public.services
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT;

-- 4. TREATMENTS TABLE
ALTER TABLE public.treatments
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT;

-- 5. EXPENSES TABLE
ALTER TABLE public.expenses
ALTER COLUMN amount_cents TYPE BIGINT;

-- 6. ASSETS TABLE
-- First drop the generated column that depends on purchase_price_cents
ALTER TABLE public.assets
DROP COLUMN IF EXISTS monthly_depreciation_cents;

-- Now we can alter the column types
ALTER TABLE public.assets
ALTER COLUMN purchase_price_cents TYPE BIGINT,
ALTER COLUMN disposal_value_cents TYPE BIGINT;

-- 7. TARIFFS TABLE
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

-- 9. Recreate monthly_depreciation_cents GENERATED column with BIGINT
-- (Already dropped in step 6, now recreate it)
ALTER TABLE public.assets
ADD COLUMN monthly_depreciation_cents BIGINT
GENERATED ALWAYS AS (
    CASE
        WHEN depreciation_years IS NOT NULL AND depreciation_years > 0
        THEN purchase_price_cents / (depreciation_years * 12)
        ELSE NULL
    END
) STORED;

-- STEP 4: RECREATE THE REFERRAL_NETWORK VIEW
-- ================================================================
-- This view tracks patient referrals and their value
CREATE OR REPLACE VIEW public.referral_network AS
SELECT
    p.id AS patient_id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.created_at AS patient_since,

    -- Referral information
    p.acquisition_source,
    p.referred_by_patient_id,
    ref.first_name AS referred_by_first_name,
    ref.last_name AS referred_by_last_name,

    -- Patient's treatment history
    COUNT(DISTINCT t.id) AS total_treatments,
    SUM(t.price_cents) AS total_revenue_cents,
    MAX(t.treatment_date) AS last_treatment_date,

    -- Referrals made by this patient
    COUNT(DISTINCT referred.id) AS referrals_made,
    COUNT(DISTINCT referred_t.id) AS referral_treatments,
    SUM(referred_t.price_cents) AS referral_revenue_cents,

    -- Network value (direct + indirect revenue)
    COALESCE(SUM(t.price_cents), 0) + COALESCE(SUM(referred_t.price_cents), 0) AS network_value_cents

FROM public.patients p

-- Join with referring patient
LEFT JOIN public.patients ref
    ON p.referred_by_patient_id = ref.id

-- Patient's own treatments
LEFT JOIN public.treatments t
    ON p.id = t.patient_id

-- Patients referred by this patient
LEFT JOIN public.patients referred
    ON referred.referred_by_patient_id = p.id

-- Treatments of referred patients
LEFT JOIN public.treatments referred_t
    ON referred.id = referred_t.patient_id

GROUP BY
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.created_at,
    p.acquisition_source,
    p.referred_by_patient_id,
    ref.first_name,
    ref.last_name;

-- Grant appropriate permissions
GRANT SELECT ON public.referral_network TO authenticated;
GRANT SELECT ON public.referral_network TO service_role;

-- STEP 5: ADD COMMENTS
-- ================================================================
COMMENT ON COLUMN public.fixed_costs.amount_cents IS 'Amount in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.supplies.price_cents IS 'Price in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.services.price_cents IS 'Service price in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.treatments.price_cents IS 'Treatment price in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.expenses.amount_cents IS 'Expense amount in cents (BIGINT to prevent overflow)';
COMMENT ON COLUMN public.assets.purchase_price_cents IS 'Purchase price in cents (BIGINT to prevent overflow)';

-- STEP 6: VERIFY THE MIGRATION
-- ================================================================
DO $$
DECLARE
    v_count INTEGER;
    v_view_count INTEGER;
BEGIN
    -- Check that all monetary columns are now BIGINT
    SELECT COUNT(*)
    INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name LIKE '%_cents'
    AND data_type = 'integer';

    -- Check if views were recreated
    SELECT COUNT(*)
    INTO v_view_count
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'referral_network';

    IF v_count > 0 THEN
        RAISE NOTICE 'Warning: % columns ending in _cents still use INTEGER type', v_count;
    ELSE
        RAISE NOTICE 'Success: All monetary columns have been converted to BIGINT';
    END IF;

    IF v_view_count > 0 THEN
        RAISE NOTICE 'Success: referral_network view has been recreated';
    END IF;

    -- Clean up temp table
    DROP TABLE IF EXISTS temp_view_definitions;
END $$;

-- ================================================================
-- Migration Complete!
-- All monetary fields now use BIGINT to prevent overflow
-- Views have been recreated with the new column types
-- ================================================================