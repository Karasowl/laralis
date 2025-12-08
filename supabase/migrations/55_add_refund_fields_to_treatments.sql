-- ============================================================================
-- Migration 55: Add refund fields to treatments
-- ============================================================================
-- This migration adds the ability to mark treatments as refunded and track
-- the refund reason. Refunded treatments impact financial calculations.
-- ============================================================================

-- Add refund fields to treatments table
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS is_refunded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
ADD COLUMN IF NOT EXISTS refund_reason text;

-- Add index for querying refunded treatments
CREATE INDEX IF NOT EXISTS idx_treatments_is_refunded
ON treatments(clinic_id, is_refunded)
WHERE is_refunded = true;

-- Add comment explaining the financial impact
COMMENT ON COLUMN treatments.is_refunded IS 'Whether this treatment was refunded. Refunded treatments: revenue=0, but costs (variable + fixed time) are still incurred as losses.';
COMMENT ON COLUMN treatments.refunded_at IS 'Timestamp when the refund was processed';
COMMENT ON COLUMN treatments.refund_reason IS 'Explanation for why the refund was issued';

-- ============================================================================
-- Financial Impact Documentation
-- ============================================================================
-- When a treatment is refunded:
-- 1. Revenue from this treatment = 0 (money returned to patient)
-- 2. Costs are STILL incurred:
--    - Variable costs (materials already used)
--    - Fixed costs (professional time already spent)
-- 3. Total loss = variable_cost_cents + (fixed_cost_per_minute_cents * minutes)
--
-- Global calculations should:
-- - Exclude refunded treatments from revenue
-- - Include refunded treatment costs as losses
-- - Track refund statistics (count, percentage, total loss)
-- ============================================================================
