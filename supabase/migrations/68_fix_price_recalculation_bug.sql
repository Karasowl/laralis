-- Migration 68: Fix price recalculation bug
-- Created: 2025-12-18
-- Purpose: Fix bug where price_cents changes unexpectedly when editing services
-- Root cause: Trigger recalculated price based on potentially stale cost fields
-- Solution: Add original_price_cents field and modify trigger to ONLY apply discounts

-- ============================================================================
-- PART 1: Add original_price_cents column
-- ============================================================================

-- Add column for storing the price BEFORE any discount is applied
-- This is the "base price" that the user sets, and discounts are applied to this
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS original_price_cents BIGINT;

-- Migrate existing data: calculate original_price_cents from current price_cents
-- For services WITHOUT discount: original = price_cents (they are the same)
-- For services WITH discount: reverse-calculate the original price
UPDATE public.services
SET original_price_cents = CASE
  -- No discount: original = current price
  WHEN discount_type IS NULL OR discount_type = 'none' THEN price_cents
  -- Percentage discount: original = price / (1 - discount/100)
  WHEN discount_type = 'percentage' AND discount_value > 0 THEN
    ROUND(price_cents / (1 - COALESCE(discount_value, 0) / 100))::BIGINT
  -- Fixed discount: original = price + discount_value * 100
  WHEN discount_type = 'fixed' AND discount_value > 0 THEN
    price_cents + (COALESCE(discount_value, 0) * 100)::BIGINT
  -- Default: use current price
  ELSE price_cents
END
WHERE original_price_cents IS NULL;

-- Set NOT NULL constraint after migration
ALTER TABLE public.services
ALTER COLUMN original_price_cents SET DEFAULT 0;

-- ============================================================================
-- PART 2: Drop and recreate the trigger function
-- ============================================================================

-- Drop the old trigger
DROP TRIGGER IF EXISTS services_calculate_final_price_trigger ON public.services;

-- Create new function that ONLY applies discounts, never recalculates price
CREATE OR REPLACE FUNCTION calculate_service_final_price()
RETURNS TRIGGER AS $$
BEGIN
  -- CRITICAL FIX: Use original_price_cents as the base, NEVER recalculate from costs
  -- This ensures the user's price is preserved and only discounts are applied

  -- If original_price_cents is not set, use the incoming price_cents
  IF NEW.original_price_cents IS NULL OR NEW.original_price_cents = 0 THEN
    NEW.original_price_cents := COALESCE(NEW.price_cents, 0);
  END IF;

  -- Apply discount based on type
  IF NEW.discount_type = 'none' OR NEW.discount_type IS NULL THEN
    -- No discount: price_cents equals original_price_cents
    NEW.price_cents := NEW.original_price_cents;
  ELSIF NEW.discount_type = 'percentage' THEN
    -- Percentage discount: reduce original price by percentage
    NEW.price_cents := ROUND(
      NEW.original_price_cents * (1 - COALESCE(NEW.discount_value, 0) / 100)
    )::BIGINT;
  ELSIF NEW.discount_type = 'fixed' THEN
    -- Fixed discount: subtract fixed amount from original price
    -- discount_value is in currency units (e.g., 10 = $10 = 1000 cents)
    NEW.price_cents := GREATEST(
      0,
      NEW.original_price_cents - (COALESCE(NEW.discount_value, 0) * 100)::BIGINT
    );
  END IF;

  -- Keep final_price_with_discount_cents in sync (deprecated but maintained for compatibility)
  NEW.final_price_with_discount_cents := NEW.price_cents;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger that ONLY fires on discount changes or original price changes
-- NOT on cost field changes (those should not affect price)
CREATE TRIGGER services_calculate_final_price_trigger
  BEFORE INSERT OR UPDATE OF original_price_cents, discount_type, discount_value
  ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION calculate_service_final_price();

-- ============================================================================
-- PART 3: Update documentation
-- ============================================================================

COMMENT ON COLUMN public.services.original_price_cents IS
  'Original price in cents BEFORE any discount is applied. This is the base price that the user defines. Discounts are calculated from this value. To get the final price customers pay, use price_cents.';

COMMENT ON COLUMN public.services.price_cents IS
  'Final price in cents AFTER discount is applied (if any). This is the price charged to the customer. Calculated automatically from original_price_cents when discounts change.';

COMMENT ON FUNCTION calculate_service_final_price() IS
  'Trigger function that calculates price_cents from original_price_cents and discount settings. NEVER recalculates price based on costs - that is done by the frontend dynamically.';

-- ============================================================================
-- VALIDATION QUERIES (Run manually to verify migration)
-- ============================================================================

-- 1. Verify all services have original_price_cents set
-- SELECT id, name, original_price_cents, price_cents, discount_type, discount_value
-- FROM services
-- WHERE original_price_cents IS NULL OR original_price_cents = 0;

-- 2. Verify discounted services have correct relationship
-- SELECT
--   name,
--   original_price_cents / 100.0 as original_price,
--   price_cents / 100.0 as final_price,
--   discount_type,
--   discount_value
-- FROM services
-- WHERE discount_type != 'none'
-- ORDER BY name;

-- 3. Test trigger by updating a discount
-- UPDATE services SET discount_type = 'percentage', discount_value = 10 WHERE id = 'some-id';
-- SELECT original_price_cents, price_cents FROM services WHERE id = 'some-id';
-- Expected: price_cents = original_price_cents * 0.9
