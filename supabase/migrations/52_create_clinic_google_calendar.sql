-- Migration: Create clinic_google_calendar table for OAuth tokens
-- Purpose: Store Google Calendar OAuth tokens per clinic for sync integration
-- Date: 2025-11-27

-- Create table for Google Calendar integration
CREATE TABLE IF NOT EXISTS clinic_google_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,                    -- Google Calendar ID to sync with
  access_token text NOT NULL,                   -- OAuth access token (encrypted at rest)
  refresh_token text NOT NULL,                  -- OAuth refresh token (encrypted at rest)
  token_expires_at timestamptz NOT NULL,        -- When access token expires
  connected_email text,                         -- Google account email
  is_active boolean DEFAULT true,               -- Whether sync is enabled
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id)                             -- One calendar per clinic
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clinic_google_calendar_clinic_id
  ON clinic_google_calendar(clinic_id);

-- Enable RLS
ALTER TABLE clinic_google_calendar ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only clinic members can access their clinic's calendar config

-- SELECT policy: Users can view their clinic's calendar config
CREATE POLICY clinic_google_calendar_select_policy ON clinic_google_calendar
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT cm.clinic_id
      FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- INSERT policy: Only workspace owners/admins can connect calendar
CREATE POLICY clinic_google_calendar_insert_policy ON clinic_google_calendar
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT cm.clinic_id
      FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
    )
  );

-- UPDATE policy: Only workspace owners/admins can update calendar config
CREATE POLICY clinic_google_calendar_update_policy ON clinic_google_calendar
  FOR UPDATE
  USING (
    clinic_id IN (
      SELECT cm.clinic_id
      FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
    )
  );

-- DELETE policy: Only workspace owners/admins can disconnect calendar
CREATE POLICY clinic_google_calendar_delete_policy ON clinic_google_calendar
  FOR DELETE
  USING (
    clinic_id IN (
      SELECT cm.clinic_id
      FROM clinic_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_clinic_google_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clinic_google_calendar_updated_at
  BEFORE UPDATE ON clinic_google_calendar
  FOR EACH ROW
  EXECUTE FUNCTION update_clinic_google_calendar_updated_at();

-- Add comment for documentation
COMMENT ON TABLE clinic_google_calendar IS 'Stores Google Calendar OAuth tokens per clinic for appointment sync';
COMMENT ON COLUMN clinic_google_calendar.calendar_id IS 'Google Calendar ID to sync appointments with';
COMMENT ON COLUMN clinic_google_calendar.access_token IS 'OAuth 2.0 access token (short-lived)';
COMMENT ON COLUMN clinic_google_calendar.refresh_token IS 'OAuth 2.0 refresh token (long-lived, used to get new access tokens)';
