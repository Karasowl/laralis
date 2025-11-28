-- Migration: Add google_event_id to treatments table
-- Purpose: Track which Google Calendar event corresponds to each treatment
-- Date: 2025-11-27

-- Add google_event_id column to treatments
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS google_event_id text;

-- Add index for faster lookups when syncing
CREATE INDEX IF NOT EXISTS idx_treatments_google_event_id
  ON treatments(google_event_id)
  WHERE google_event_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN treatments.google_event_id IS 'Google Calendar event ID for synced appointments (null if not synced)';
