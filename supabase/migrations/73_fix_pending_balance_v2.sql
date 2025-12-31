-- Migration: 73_fix_pending_balance_v2.sql
-- Description: CORRECT fix - drop trigger BEFORE updating data
-- Date: 2025-12-31
--
-- PROBLEM: Migration 72 failed because the old trigger runs during UPDATE
--          and recalculates pending_balance back to (price - amount_paid)
--
-- FIX: Drop trigger FIRST, then update data, then create new trigger

-- =====================================================
-- STEP 1: DROP ALL TRIGGERS FIRST (critical!)
-- =====================================================

DROP TRIGGER IF EXISTS trigger_calculate_treatment_payment_status ON treatments;
DROP TRIGGER IF EXISTS trigger_calculate_treatment_is_paid ON treatments;

-- Also drop the old function to be safe
DROP FUNCTION IF EXISTS calculate_treatment_payment_status() CASCADE;

-- =====================================================
-- STEP 2: NOW update data (no trigger will interfere)
-- =====================================================

-- Set pending_balance to 0 for ALL treatments (they are considered paid)
-- Also set amount_paid = price for completed ones (logical consistency)
UPDATE treatments
SET
    pending_balance_cents = 0,
    amount_paid_cents = COALESCE(price_cents, 0),
    is_paid = true;

-- =====================================================
-- STEP 3: Create NEW trigger with correct logic
-- =====================================================

-- New function - is_paid is based on pending_balance, NOT auto-calculated
CREATE OR REPLACE FUNCTION calculate_treatment_is_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- is_paid is true when:
  -- 1. No pending balance (fully paid or never had debt)
  -- 2. Status is cancelled (no payment required)
  NEW.is_paid := (
    COALESCE(NEW.pending_balance_cents, 0) = 0 OR
    NEW.status = 'cancelled'
  );

  -- Ensure pending_balance_cents is never negative or null
  IF NEW.pending_balance_cents IS NULL OR NEW.pending_balance_cents < 0 THEN
    NEW.pending_balance_cents := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger with new function
CREATE TRIGGER trigger_calculate_treatment_is_paid
BEFORE INSERT OR UPDATE ON treatments
FOR EACH ROW
EXECUTE FUNCTION calculate_treatment_is_paid();

-- =====================================================
-- STEP 4: Update comments
-- =====================================================

COMMENT ON COLUMN treatments.pending_balance_cents IS 'User-controlled: remaining balance owed. Default 0 = paid. Set manually when patient owes money.';
COMMENT ON COLUMN treatments.amount_paid_cents IS 'Optional tracking of partial payments made.';
COMMENT ON COLUMN treatments.is_paid IS 'Auto-calculated: true when pending_balance = 0 or cancelled.';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  pending_count integer;
  total_balance bigint;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(pending_balance_cents), 0)
  INTO pending_count, total_balance
  FROM treatments
  WHERE pending_balance_cents > 0;

  IF pending_count > 0 THEN
    RAISE EXCEPTION 'FIX FAILED: Still % treatments with pending balance (total: %)', pending_count, total_balance;
  ELSE
    RAISE NOTICE '✅ Migration 73 SUCCESS: All treatments have pending_balance = 0';
  END IF;
END $$;
