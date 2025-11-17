-- Migration: Add discount fields to services table
-- Created: 2025-11-17
-- Purpose: Move discount functionality from tariffs to services for simplified architecture
-- Impact: Migrates existing discount data from tariffs (if any) to services

-- ============================================================================
-- STEP 1: Add discount columns to services table
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'none'
    CHECK (discount_type IN ('none', 'percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0
    CHECK (discount_value >= 0),
  ADD COLUMN IF NOT EXISTS discount_reason TEXT,
  ADD COLUMN IF NOT EXISTS final_price_with_discount_cents INTEGER;

-- ============================================================================
-- STEP 2: Create function to auto-calculate final price with discount
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_service_final_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate final price based on discount type
  IF NEW.discount_type = 'percentage' THEN
    -- Percentage discount: reduce price by percentage
    NEW.final_price_with_discount_cents := ROUND(
      NEW.price_cents * (1 - NEW.discount_value / 100)
    )::INTEGER;
  ELSIF NEW.discount_type = 'fixed' THEN
    -- Fixed discount: subtract fixed amount (in currency units, not cents)
    -- Example: discount_value = 10 means $10 = 1000 cents
    NEW.final_price_with_discount_cents := GREATEST(
      0,
      NEW.price_cents - (NEW.discount_value * 100)::INTEGER
    );
  ELSE
    -- No discount: final price = base price
    NEW.final_price_with_discount_cents := NEW.price_cents;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Create trigger to auto-update final price on changes
-- ============================================================================

DROP TRIGGER IF EXISTS services_calculate_final_price_trigger ON public.services;

CREATE TRIGGER services_calculate_final_price_trigger
  BEFORE INSERT OR UPDATE OF price_cents, discount_type, discount_value
  ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION calculate_service_final_price();

-- ============================================================================
-- STEP 4: Migrate existing discount data from tariffs to services
-- ============================================================================

-- Update services with discount data from tariffs (if exists)
UPDATE public.services s
SET
  discount_type = COALESCE(t.discount_type, 'none'),
  discount_value = COALESCE(t.discount_value, 0),
  discount_reason = t.discount_reason,
  final_price_with_discount_cents = COALESCE(
    t.final_price_with_discount_cents,
    s.price_cents
  )
FROM public.tariffs t
WHERE s.id = t.service_id
  AND t.version = 1  -- Only current version (always 1 in practice)
  AND t.is_active = true;

-- For services without any tariff, set final price = base price
UPDATE public.services
SET final_price_with_discount_cents = price_cents
WHERE final_price_with_discount_cents IS NULL;

-- ============================================================================
-- STEP 5: Create indexes for performance
-- ============================================================================

-- Index for filtering services with discounts
CREATE INDEX IF NOT EXISTS idx_services_discount
  ON public.services(discount_type)
  WHERE discount_type != 'none';

-- ============================================================================
-- STEP 6: Add documentation comments
-- ============================================================================

COMMENT ON COLUMN public.services.discount_type IS
  'Type of discount: none (default), percentage (e.g., 10%), or fixed (e.g., $10)';

COMMENT ON COLUMN public.services.discount_value IS
  'Discount value - percentage (0-100) for percentage type, or amount in currency for fixed type';

COMMENT ON COLUMN public.services.discount_reason IS
  'Optional reason/description for the discount (e.g., "Seasonal promotion", "Loyalty discount")';

COMMENT ON COLUMN public.services.final_price_with_discount_cents IS
  'Final price in cents after applying discount - auto-calculated by trigger';

-- ============================================================================
-- VALIDATION QUERIES (Run manually to verify migration)
-- ============================================================================

-- To verify migration success, run these queries in SQL Editor:

-- 1. Check all services have final_price set
-- SELECT COUNT(*) FROM services WHERE final_price_with_discount_cents IS NULL;
-- Expected: 0

-- 2. Verify discount calculations are correct
-- SELECT
--   name,
--   price_cents / 100.0 as base_price,
--   discount_type,
--   discount_value,
--   final_price_with_discount_cents / 100.0 as final_price
-- FROM services
-- WHERE discount_type != 'none';

-- 3. Check how many services were migrated with discounts
-- SELECT
--   discount_type,
--   COUNT(*) as count
-- FROM services
-- GROUP BY discount_type;
