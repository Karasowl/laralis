-- Migration 49: Simplify price architecture
-- Created: 2025-11-17
-- Purpose: Make price_cents the single source of truth for final price (with discount applied)
--          Simplifies the system by eliminating confusion between price_cents and final_price_with_discount_cents
-- Impact: Migrates existing data safely, updates trigger, deprecates final_price_with_discount_cents

-- ============================================================================
-- PART 1: Migrate existing data
-- ============================================================================

-- For services with discounts, make price_cents the final price (with discount)
-- Save the original price_cents (without discount) temporarily in a comment
COMMENT ON COLUMN public.services.final_price_with_discount_cents IS
  'DEPRECATED: This field is no longer used. price_cents now stores the final price with discount applied. This column is kept for backward compatibility and will be removed in a future migration.';

-- Update price_cents to be the final price for services with discounts
UPDATE public.services
SET price_cents = final_price_with_discount_cents
WHERE discount_type != 'none'
  AND discount_type IS NOT NULL
  AND final_price_with_discount_cents IS NOT NULL;

-- ============================================================================
-- PART 2: Update trigger to modify price_cents instead of final_price_with_discount_cents
-- ============================================================================

-- Drop the old trigger
DROP TRIGGER IF EXISTS services_calculate_final_price_trigger ON public.services;

-- Recreate the function to update price_cents based on discount
-- Strategy: Calculate total cost from fixed + variable, apply margin, then apply discount
CREATE OR REPLACE FUNCTION calculate_service_final_price()
RETURNS TRIGGER AS $$
DECLARE
  total_cost_cents INTEGER;
  original_price INTEGER;
BEGIN
  -- Calculate the total cost (fixed + variable)
  total_cost_cents := COALESCE(
    (NEW.fixed_cost_per_minute_cents * NEW.est_minutes) + NEW.variable_cost_cents,
    0
  );

  -- Calculate the original price (cost + margin) before any discount
  IF total_cost_cents > 0 THEN
    original_price := ROUND(total_cost_cents * (1 + COALESCE(NEW.margin_pct, 0) / 100))::INTEGER;
  ELSE
    -- Fallback: if no cost, use price_cents as is
    original_price := COALESCE(NEW.price_cents, 0);
  END IF;

  -- Apply discount based on type
  IF NEW.discount_type = 'none' OR NEW.discount_type IS NULL THEN
    -- No discount: price_cents is the original price
    NEW.price_cents := original_price;
  ELSIF NEW.discount_type = 'percentage' THEN
    -- Percentage discount: reduce original price by percentage
    NEW.price_cents := ROUND(
      original_price * (1 - COALESCE(NEW.discount_value, 0) / 100)
    )::INTEGER;
  ELSIF NEW.discount_type = 'fixed' THEN
    -- Fixed discount: subtract fixed amount from original price
    -- discount_value is in currency units (e.g., 10 = $10 = 1000 cents)
    NEW.price_cents := GREATEST(
      0,
      original_price - (COALESCE(NEW.discount_value, 0) * 100)::INTEGER
    );
  END IF;

  -- Keep final_price_with_discount_cents in sync (deprecated but maintained)
  NEW.final_price_with_discount_cents := NEW.price_cents;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger that fires on cost or discount changes
CREATE TRIGGER services_calculate_final_price_trigger
  BEFORE INSERT OR UPDATE OF fixed_cost_per_minute_cents, variable_cost_cents, est_minutes, margin_pct, discount_type, discount_value
  ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION calculate_service_final_price();

-- ============================================================================
-- PART 3: Update documentation
-- ============================================================================

COMMENT ON COLUMN public.services.price_cents IS
  'Final price in cents with discount applied (if any). This is the price charged to the customer. To calculate the original price before discount, use: price_cents / (1 - discount_value/100) for percentage discounts.';

COMMENT ON COLUMN public.services.discount_type IS
  'Type of discount applied to this service. When set to percentage or fixed, price_cents will be automatically reduced.';

COMMENT ON COLUMN public.services.discount_value IS
  'Discount amount. For percentage type: 0-100 (e.g., 20 means 20% off). For fixed type: amount in currency units (e.g., 50 means $50 off).';

-- ============================================================================
-- VALIDATION QUERIES (Run manually to verify migration)
-- ============================================================================

-- To verify migration success, run these queries in SQL Editor:

-- 1. Check that all services with discounts have price_cents updated
-- SELECT
--   name,
--   discount_type,
--   discount_value,
--   price_cents / 100.0 as final_price,
--   final_price_with_discount_cents / 100.0 as deprecated_field
-- FROM services
-- WHERE discount_type != 'none';
-- Expected: price_cents should equal final_price_with_discount_cents

-- 2. Test trigger: Apply a discount and verify price_cents is updated
-- UPDATE services
-- SET discount_type = 'percentage', discount_value = 20
-- WHERE id = 'some-service-id';
-- Then check: SELECT price_cents, final_price_with_discount_cents FROM services WHERE id = 'some-service-id';
-- Expected: Both fields should show the discounted price

-- 3. Verify treatments still work with historical snapshots
-- SELECT
--   t.id,
--   t.price_cents / 100.0 as treatment_price,
--   t.snapshot_costs->>'price_cents' as snapshot_price,
--   s.name as service_name
-- FROM treatments t
-- JOIN services s ON s.id = t.service_id
-- LIMIT 10;
-- Expected: Treatment prices should be unchanged from their creation time
