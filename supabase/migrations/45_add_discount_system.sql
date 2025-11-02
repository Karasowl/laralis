-- Migration 45: Add Discount System
-- Description: Adds support for global discounts (clinic-level) and individual service discounts (tariff-level)
-- Date: 2025-11-02
-- Author: Claude

-- ============================================================================
-- PART 1: Add global discount configuration to clinics table
-- ============================================================================

-- Add JSONB column for global discount configuration
-- Structure: {
--   "enabled": boolean,
--   "type": "percentage" | "fixed",
--   "value": number
-- }
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS global_discount_config JSONB
DEFAULT '{
  "enabled": false,
  "type": "percentage",
  "value": 0
}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN clinics.global_discount_config IS
'Global discount configuration for the clinic. Structure: {"enabled": bool, "type": "percentage"|"fixed", "value": number}. This discount applies to all services by default unless overridden at tariff level.';

-- ============================================================================
-- PART 2: Add discount fields to tariffs table
-- ============================================================================

-- Add discount type field (none, percentage, fixed)
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20)
DEFAULT 'none'
CHECK (discount_type IN ('none', 'percentage', 'fixed'));

-- Add discount value (percentage 0-100 or fixed amount in cents)
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2)
DEFAULT 0
CHECK (discount_value >= 0);

-- Add optional reason/description for the discount
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- Add final price with discount applied (in cents)
ALTER TABLE tariffs
ADD COLUMN IF NOT EXISTS final_price_with_discount_cents INTEGER;

-- Add comments
COMMENT ON COLUMN tariffs.discount_type IS
'Type of discount: "none" (no discount), "percentage" (% off), "fixed" (fixed amount off in cents)';

COMMENT ON COLUMN tariffs.discount_value IS
'Discount value: if type=percentage, value is 0-100 (e.g., 10 = 10%); if type=fixed, value is amount in cents';

COMMENT ON COLUMN tariffs.discount_reason IS
'Optional description or reason for the discount (e.g., "Black Friday Promotion", "Loyalty Discount")';

COMMENT ON COLUMN tariffs.final_price_with_discount_cents IS
'Final price after applying discount. If no discount, this equals rounded_price_cents.';

-- ============================================================================
-- PART 3: Create index for performance on discount queries
-- ============================================================================

-- Index for finding tariffs with active discounts
CREATE INDEX IF NOT EXISTS idx_tariffs_discount_type
ON tariffs(discount_type)
WHERE discount_type != 'none';

-- ============================================================================
-- PART 4: Update existing tariffs to have final_price_with_discount_cents
-- ============================================================================

-- Set final_price_with_discount_cents = rounded_price_cents for existing records (no discount)
UPDATE tariffs
SET final_price_with_discount_cents = rounded_price_cents
WHERE final_price_with_discount_cents IS NULL;

-- ============================================================================
-- PART 5: Add RLS policies for new fields (if not covered by existing policies)
-- ============================================================================

-- Note: Existing RLS policies on clinics and tariffs tables should cover these new columns.
-- If specific policies are needed, they can be added here.

-- ============================================================================
-- PART 6: Create helper function to calculate discounted price
-- ============================================================================

-- Function to calculate final price with discount
CREATE OR REPLACE FUNCTION calculate_discounted_price(
  base_price_cents INTEGER,
  discount_type VARCHAR(20),
  discount_value NUMERIC(10,2)
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  discount_amount_cents INTEGER;
  final_price INTEGER;
BEGIN
  -- If no discount, return base price
  IF discount_type = 'none' OR discount_value = 0 THEN
    RETURN base_price_cents;
  END IF;

  -- Calculate discount based on type
  IF discount_type = 'percentage' THEN
    -- Percentage discount
    discount_amount_cents := ROUND(base_price_cents * (discount_value / 100.0));
  ELSIF discount_type = 'fixed' THEN
    -- Fixed amount discount (discount_value is already in cents)
    discount_amount_cents := discount_value::INTEGER;
  ELSE
    -- Unknown type, return base price
    RETURN base_price_cents;
  END IF;

  -- Calculate final price (ensure it doesn't go below 0)
  final_price := base_price_cents - discount_amount_cents;

  -- Ensure price is not negative
  IF final_price < 0 THEN
    final_price := 0;
  END IF;

  RETURN final_price;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION calculate_discounted_price IS
'Calculates final price after applying discount. Returns price in cents. Ensures price never goes below 0.';

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for manual testing)
-- ============================================================================

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'clinics' AND column_name = 'global_discount_config';

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'tariffs' AND column_name LIKE 'discount%';

-- SELECT calculate_discounted_price(10000, 'percentage', 10);  -- Should return 9000 (10% off $100)
-- SELECT calculate_discounted_price(10000, 'fixed', 1000);     -- Should return 9000 ($10 off $100)
-- SELECT calculate_discounted_price(10000, 'none', 0);         -- Should return 10000 (no discount)
