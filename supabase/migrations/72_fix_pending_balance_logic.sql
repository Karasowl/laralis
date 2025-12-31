-- Migration: 72_fix_pending_balance_logic.sql
-- Description: Fix pending_balance_cents logic - should be user-controlled, not auto-calculated
-- Date: 2025-12-31
--
-- PROBLEM: Migration 71 auto-calculated pending_balance = price - amount_paid
--          This caused ALL existing treatments to show full price as pending
--
-- FIX: pending_balance_cents is USER-CONTROLLED (explicit marking)
--      - Default is 0 (paid)
--      - User sets it manually when creating treatment with pending payment
--      - is_paid = (pending_balance_cents = 0 OR status = 'cancelled')

-- =====================================================
-- STEP 1: Fix existing data - all legacy treatments are PAID
-- =====================================================

-- Set pending_balance to 0 for ALL existing treatments (they were already paid)
UPDATE treatments
SET pending_balance_cents = 0,
    is_paid = true
WHERE pending_balance_cents > 0 OR is_paid = false;

-- =====================================================
-- STEP 2: Replace trigger with simpler logic
-- =====================================================

-- Drop the old trigger
DROP TRIGGER IF EXISTS trigger_calculate_treatment_payment_status ON treatments;

-- Create new function - only manages is_paid based on pending_balance
CREATE OR REPLACE FUNCTION calculate_treatment_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- is_paid is true when:
  -- 1. No pending balance (fully paid or never had debt)
  -- 2. Status is cancelled (no payment required)
  NEW.is_paid := (
    NEW.pending_balance_cents = 0 OR
    NEW.pending_balance_cents IS NULL OR
    NEW.status = 'cancelled'
  );

  -- Ensure pending_balance_cents is never negative
  IF NEW.pending_balance_cents < 0 THEN
    NEW.pending_balance_cents := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_calculate_treatment_payment_status
BEFORE INSERT OR UPDATE ON treatments
FOR EACH ROW
EXECUTE FUNCTION calculate_treatment_payment_status();

-- =====================================================
-- STEP 3: Update comments to reflect correct logic
-- =====================================================

COMMENT ON COLUMN treatments.pending_balance_cents IS 'User-controlled: remaining balance owed by patient. Default 0 = fully paid. Set manually when creating/editing treatment.';
COMMENT ON COLUMN treatments.is_paid IS 'Auto-calculated: true when pending_balance_cents = 0 or status = cancelled';
COMMENT ON COLUMN treatments.amount_paid_cents IS 'Optional: track partial payments made. Not used for is_paid calculation.';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  pending_count integer;
BEGIN
  -- Check no treatments have pending balance (all should be 0 now)
  SELECT COUNT(*) INTO pending_count
  FROM treatments
  WHERE pending_balance_cents > 0;

  IF pending_count > 0 THEN
    RAISE WARNING 'There are still % treatments with pending balance', pending_count;
  ELSE
    RAISE NOTICE 'Migration 72 completed: All existing treatments marked as paid (pending_balance = 0)';
  END IF;
END $$;
