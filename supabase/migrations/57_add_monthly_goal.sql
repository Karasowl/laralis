-- Migration: Add monthly goal configuration to settings_time
-- Date: 2025-12-09
-- Description: This allows clinics to set a revenue target independent of break-even.
--              If NULL, break-even is used as the target. If set, shows as secondary
--              marker in BreakEvenProgress component.

-- Add monthly_goal_cents column
ALTER TABLE public.settings_time
ADD COLUMN IF NOT EXISTS monthly_goal_cents bigint DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.settings_time.monthly_goal_cents IS
  'Monthly revenue goal in cents. If NULL, break-even is used as the target. If set, shows as secondary marker in BreakEvenProgress.';

-- Note: No RLS changes needed - settings_time already has proper clinic-based policies

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings_time'
      AND column_name = 'monthly_goal_cents'
  ) THEN
    RAISE EXCEPTION 'Column monthly_goal_cents was not added successfully';
  END IF;

  RAISE NOTICE 'Migration 57: monthly_goal_cents column added successfully';
END $$;
