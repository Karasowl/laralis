-- Migration: Add working_days_config to settings_time
-- Purpose: Store manual configuration and detected pattern of working days
-- Date: 2025-10-20

-- Add working_days_config column to settings_time
ALTER TABLE public.settings_time
ADD COLUMN IF NOT EXISTS working_days_config JSONB DEFAULT '{
  "manual": {
    "monday": true,
    "tuesday": true,
    "wednesday": true,
    "thursday": true,
    "friday": true,
    "saturday": true,
    "sunday": false
  },
  "detected": null,
  "useHistorical": true
}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.settings_time.working_days_config IS
'Configuration for working days. Structure:
{
  "manual": { "monday": bool, ..., "sunday": bool },
  "detected": {
    "pattern": { "monday": 0-1, ..., "sunday": 0-1 },
    "confidence": 0-100,
    "sampleSize": number,
    "lastUpdated": ISO date string
  } | null,
  "useHistorical": bool
}';

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings_time'
      AND column_name = 'working_days_config'
  ) THEN
    RAISE EXCEPTION 'Column working_days_config was not added successfully';
  END IF;

  RAISE NOTICE 'Migration 40: working_days_config column added successfully';
END $$;
