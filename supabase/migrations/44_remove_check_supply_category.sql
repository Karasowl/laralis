-- ============================================================================
-- Migration 44: Remove check_supply_category constraint from supplies table
-- Description: Removes the hardcoded CHECK constraint that validates supply
--              categories against a fixed enum, allowing dynamic categories
--              from the categories table.
-- Date: 2025-10-30
-- Related: Fix for "violates check constraint check_supply_category" error
-- ============================================================================

-- BACKGROUND:
-- Migration 04 created a constraint called 'check_supply_category' that only
-- allowed: 'insumo', 'bioseguridad', 'consumibles', 'materiales',
--          'medicamentos', 'equipos', 'otros'
--
-- Migration 36 attempted to remove 'supplies_category_check' but the actual
-- constraint name is 'check_supply_category' (singular 'supply')
--
-- This migration fixes the issue by removing the correct constraint.

-- STEP 1: Drop the view that depends on supplies.category
DROP VIEW IF EXISTS public.low_stock_alerts;

-- STEP 2: Check if the constraint exists and remove it
DO $$
BEGIN
  -- Check if constraint exists
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'check_supply_category'
      AND t.relname = 'supplies'
      AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE 'Removing constraint check_supply_category...';
    ALTER TABLE public.supplies DROP CONSTRAINT check_supply_category;
    RAISE NOTICE '✓ Constraint removed successfully';
  ELSE
    RAISE NOTICE 'Constraint check_supply_category does not exist (already removed or never created)';
  END IF;
END $$;

-- STEP 3: Ensure category column is flexible VARCHAR
ALTER TABLE public.supplies
ALTER COLUMN category TYPE VARCHAR(100);

-- STEP 4: Update column comment for documentation
COMMENT ON COLUMN public.supplies.category IS
  'Flexible category field that accepts both system categories (from categories table) and custom categories. No longer restricted by CHECK constraint.';

-- STEP 5: Recreate the low_stock_alerts view with the same definition
CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT
    s.id,
    s.name,
    s.category,
    s.stock_quantity,
    s.min_stock_alert,
    s.clinic_id,
    c.name as clinic_name
FROM public.supplies s
JOIN public.clinics c ON s.clinic_id = c.id
WHERE s.stock_quantity <= s.min_stock_alert
  AND s.stock_quantity >= 0;

COMMENT ON VIEW public.low_stock_alerts IS 'View for supplies with low stock levels';

-- STEP 6: Verification
DO $$
DECLARE
  constraint_count INTEGER;
  column_type TEXT;
  view_exists BOOLEAN;
BEGIN
  -- Verify constraint was removed
  SELECT COUNT(*) INTO constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE c.conname = 'check_supply_category'
    AND t.relname = 'supplies'
    AND n.nspname = 'public';

  -- Get column type
  SELECT data_type INTO column_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'supplies'
    AND column_name = 'category';

  -- Check if view was recreated
  SELECT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'low_stock_alerts'
  ) INTO view_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION 44 - VERIFICATION';
  RAISE NOTICE '========================================';

  IF constraint_count = 0 THEN
    RAISE NOTICE '✓ Constraint check_supply_category: REMOVED';
  ELSE
    RAISE WARNING '✗ Constraint check_supply_category: STILL EXISTS!';
  END IF;

  RAISE NOTICE '✓ Column type: %', column_type;

  IF view_exists THEN
    RAISE NOTICE '✓ View low_stock_alerts: RECREATED';
  ELSE
    RAISE WARNING '✗ View low_stock_alerts: NOT FOUND!';
  END IF;

  IF constraint_count = 0 AND column_type = 'character varying' AND view_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ MIGRATION SUCCESSFUL ✓✓✓';
    RAISE NOTICE 'supplies.category now accepts dynamic values';
    RAISE NOTICE 'low_stock_alerts view recreated successfully';
  ELSE
    RAISE EXCEPTION 'Migration verification failed!';
  END IF;

  RAISE NOTICE '========================================';
END $$;
