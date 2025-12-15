-- Migration 67: Granular SMS Notification Settings
-- Author: Claude Code
-- Date: 2025-12-14
-- Description: Extends notification_settings with granular SMS controls for patients and staff

-- ============================================================================
-- SCHEMA DOCUMENTATION
-- ============================================================================
--
-- The notification_settings.sms JSONB field now supports this structure:
--
-- {
--   "enabled": true,                    -- Master switch for SMS
--   "default_country_code": "52",       -- Default country code (Mexico)
--
--   "patient": {                        -- Notifications TO PATIENTS
--     "on_treatment_created": true,     -- When treatment is scheduled
--     "on_treatment_updated": true,     -- When treatment date/time/service changes
--     "reminder_24h": true,             -- 24 hours before appointment
--     "reminder_2h": true               -- 2 hours before appointment
--   },
--
--   "staff": {                          -- Notifications TO CLINIC STAFF
--     "enabled": true,                  -- Master switch for staff notifications
--     "phone": "+521234567890",         -- Primary staff phone
--     "extra_phone": "",                -- Additional phone (optional)
--     "on_treatment_created": true,     -- When treatment is scheduled
--     "on_treatment_updated": true,     -- When treatment changes
--     "reminder_24h": true,             -- 24h reminder with patient details
--     "reminder_2h": false              -- 2h reminder with patient details
--   }
-- }
--
-- Patient notifications include:
--   - Treatment/service name
--   - Date and time
--   - Clinic name
--   - What changed (for updates)
--
-- Staff notifications include ALL patient data PLUS:
--   - Patient name
--   - Patient phone
--   - What changed (for updates)
--
-- ============================================================================

-- Add comment documenting the schema
COMMENT ON COLUMN clinics.notification_settings IS
'Notification preferences including email, SMS, WhatsApp, and push settings.

SMS settings structure:
{
  "sms": {
    "enabled": boolean,
    "default_country_code": string,
    "patient": {
      "on_treatment_created": boolean,
      "on_treatment_updated": boolean,
      "reminder_24h": boolean,
      "reminder_2h": boolean
    },
    "staff": {
      "enabled": boolean,
      "phone": string,
      "extra_phone": string,
      "on_treatment_created": boolean,
      "on_treatment_updated": boolean,
      "reminder_24h": boolean,
      "reminder_2h": boolean
    }
  }
}';

-- ============================================================================
-- HELPER FUNCTION: Get SMS settings with defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sms_settings(clinic_settings jsonb)
RETURNS jsonb AS $$
DECLARE
  sms_config jsonb;
  default_config jsonb;
BEGIN
  -- Default configuration
  default_config := '{
    "enabled": false,
    "default_country_code": "52",
    "patient": {
      "on_treatment_created": true,
      "on_treatment_updated": true,
      "reminder_24h": true,
      "reminder_2h": false
    },
    "staff": {
      "enabled": false,
      "phone": "",
      "extra_phone": "",
      "on_treatment_created": true,
      "on_treatment_updated": true,
      "reminder_24h": true,
      "reminder_2h": false
    }
  }'::jsonb;

  -- Get SMS config or use defaults
  sms_config := COALESCE(clinic_settings->'sms', '{}'::jsonb);

  -- Merge with defaults (deep merge)
  RETURN default_config || sms_config;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_sms_settings IS 'Returns SMS settings with defaults applied for missing fields';

-- ============================================================================
-- HELPER FUNCTION: Check if specific notification is enabled
-- ============================================================================

CREATE OR REPLACE FUNCTION is_sms_notification_enabled(
  clinic_settings jsonb,
  recipient_type text,  -- 'patient' or 'staff'
  event_type text       -- 'on_treatment_created', 'on_treatment_updated', 'reminder_24h', 'reminder_2h'
)
RETURNS boolean AS $$
DECLARE
  sms_config jsonb;
BEGIN
  sms_config := get_sms_settings(clinic_settings);

  -- Check master switch
  IF NOT (sms_config->>'enabled')::boolean THEN
    RETURN false;
  END IF;

  -- Check staff master switch if recipient is staff
  IF recipient_type = 'staff' AND NOT (sms_config->'staff'->>'enabled')::boolean THEN
    RETURN false;
  END IF;

  -- Check specific event
  RETURN COALESCE((sms_config->recipient_type->>event_type)::boolean, false);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_sms_notification_enabled IS 'Checks if a specific SMS notification type is enabled for a clinic';
