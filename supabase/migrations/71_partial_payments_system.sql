-- Migration: 71_partial_payments_system.sql
-- Description: Add partial payments support to treatments and remove quotes module
-- Date: 2025-12-30

-- =====================================================
-- PART 1: ADD PARTIAL PAYMENTS TO TREATMENTS
-- =====================================================

-- Add amount_paid_cents column for tracking partial payments
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS amount_paid_cents bigint NOT NULL DEFAULT 0;

-- Add is_paid as a computed column (true when fully paid or cancelled)
-- Note: We can't use GENERATED ALWAYS AS in Supabase, so we use a trigger instead
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;

-- Create function to auto-calculate is_paid
CREATE OR REPLACE FUNCTION calculate_treatment_is_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Treatment is considered paid if:
  -- 1. Status is cancelled (no payment required)
  -- 2. Amount paid >= price (fully paid)
  NEW.is_paid := (
    NEW.status = 'cancelled' OR
    (NEW.amount_paid_cents >= NEW.price_cents AND NEW.price_cents > 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate is_paid on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_treatment_is_paid ON treatments;
CREATE TRIGGER trigger_calculate_treatment_is_paid
BEFORE INSERT OR UPDATE ON treatments
FOR EACH ROW
EXECUTE FUNCTION calculate_treatment_is_paid();

-- Update existing treatments: set is_paid = true for completed treatments
-- (assuming legacy treatments without amount_paid were fully paid)
UPDATE treatments
SET is_paid = true
WHERE status = 'completed' AND is_paid = false;

-- Index for efficient queries on pending balance
CREATE INDEX IF NOT EXISTS idx_treatments_pending_balance
ON treatments(clinic_id, patient_id)
WHERE is_paid = false;

-- Index for filtering by payment status
CREATE INDEX IF NOT EXISTS idx_treatments_is_paid
ON treatments(clinic_id, is_paid);

COMMENT ON COLUMN treatments.amount_paid_cents IS 'Total amount paid by patient in cents. Use for partial payments tracking.';
COMMENT ON COLUMN treatments.is_paid IS 'Auto-calculated: true when fully paid (amount_paid >= price) or cancelled';

-- =====================================================
-- PART 2: REMOVE QUOTES MODULE
-- =====================================================

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS trigger_generate_quote_number ON quotes;
DROP TRIGGER IF EXISTS trigger_calculate_quote_valid_until ON quotes;
DROP TRIGGER IF EXISTS trigger_calculate_quote_item_totals ON quote_items;
DROP TRIGGER IF EXISTS trigger_update_quote_totals ON quote_items;
DROP TRIGGER IF EXISTS update_quotes_timestamp ON quotes;

-- Drop functions
DROP FUNCTION IF EXISTS generate_quote_number() CASCADE;
DROP FUNCTION IF EXISTS calculate_quote_valid_until() CASCADE;
DROP FUNCTION IF EXISTS calculate_quote_item_totals() CASCADE;
DROP FUNCTION IF EXISTS update_quote_totals() CASCADE;
DROP FUNCTION IF EXISTS convert_quote_to_treatments(uuid, date) CASCADE;

-- Drop policies (RLS)
DROP POLICY IF EXISTS "Users can view own clinic quotes" ON quotes;
DROP POLICY IF EXISTS "Users can manage own clinic quotes" ON quotes;
DROP POLICY IF EXISTS "Users can view quote items" ON quote_items;
DROP POLICY IF EXISTS "Users can manage quote items" ON quote_items;

-- Drop tables (quote_items first due to FK constraint)
DROP TABLE IF EXISTS quote_items CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that treatments has the new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treatments' AND column_name = 'amount_paid_cents'
  ) THEN
    RAISE EXCEPTION 'Migration failed: amount_paid_cents column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'treatments' AND column_name = 'is_paid'
  ) THEN
    RAISE EXCEPTION 'Migration failed: is_paid column not found';
  END IF;

  -- Check quotes tables are gone
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name IN ('quotes', 'quote_items')
  ) THEN
    RAISE EXCEPTION 'Migration failed: quotes tables still exist';
  END IF;

  RAISE NOTICE 'Migration 71 completed successfully: partial payments added, quotes module removed';
END $$;
