-- Migration: Explicit Pending Balance System
-- Date: 2025-12-31
-- Description: Add explicit pending_balance_cents field for user-marked pending payments
--              This replaces the automatic is_paid calculation with explicit user input

-- Add new column for explicit pending balance
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS pending_balance_cents bigint DEFAULT NULL;

COMMENT ON COLUMN treatments.pending_balance_cents IS
'Saldo pendiente marcado explícitamente por el usuario. NULL = sin saldo pendiente (pagado completo).';

-- All existing treatments start with no pending balance (user will mark explicitly)
-- The column defaults to NULL which means "no pending balance"

-- Create index for filtering treatments with pending balance
CREATE INDEX IF NOT EXISTS idx_treatments_pending_balance
ON treatments(clinic_id, pending_balance_cents)
WHERE pending_balance_cents IS NOT NULL AND pending_balance_cents > 0;

-- Add helpful comment
COMMENT ON TABLE treatments IS
'Treatment records. Use pending_balance_cents for explicit pending payment tracking (NULL = paid, >0 = pending amount).';
