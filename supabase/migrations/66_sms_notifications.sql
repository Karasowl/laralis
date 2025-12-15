-- Migration 66: SMS Notifications Support
-- Author: Claude Code
-- Date: 2025-12-14
-- Description: Add SMS notifications table and RLS policies

-- ============================================================================
-- TABLE: sms_notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS sms_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,

  -- Notification details
  notification_type varchar(50) NOT NULL CHECK (notification_type IN (
    'appointment_confirmation',
    'appointment_reminder',
    'appointment_cancelled',
    'appointment_rescheduled',
    'booking_received',
    'booking_confirmed',
    'custom'
  )),
  recipient_phone varchar(50) NOT NULL,
  recipient_name varchar(255),
  message_content text NOT NULL,

  -- Status tracking
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'delivered',
    'failed',
    'undelivered'
  )),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,

  -- Provider details
  provider varchar(50) DEFAULT 'twilio',
  provider_message_id varchar(255),
  cost_cents int DEFAULT 2, -- ~2 cents USD per SMS (typical Twilio price)

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_sms_notifications_clinic ON sms_notifications(clinic_id);
CREATE INDEX idx_sms_notifications_treatment ON sms_notifications(treatment_id);
CREATE INDEX idx_sms_notifications_patient ON sms_notifications(patient_id);
CREATE INDEX idx_sms_notifications_status ON sms_notifications(status);
CREATE INDEX idx_sms_notifications_created ON sms_notifications(created_at DESC);
CREATE INDEX idx_sms_notifications_provider_id ON sms_notifications(provider_message_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE sms_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view SMS notifications for their clinics
CREATE POLICY "Users can view sms notifications for their clinics"
  ON sms_notifications FOR SELECT
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Users can insert SMS notifications for their clinics
CREATE POLICY "Users can insert sms notifications for their clinics"
  ON sms_notifications FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Users can update SMS notifications for their clinics
CREATE POLICY "Users can update sms notifications for their clinics"
  ON sms_notifications FOR UPDATE
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Service role can manage all SMS notifications (for cron jobs and webhooks)
CREATE POLICY "Service role can manage sms notifications"
  ON sms_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sms_notifications IS 'SMS notifications sent via Twilio';
COMMENT ON COLUMN sms_notifications.notification_type IS 'Type of notification (appointment_confirmation, reminder, etc.)';
COMMENT ON COLUMN sms_notifications.status IS 'Delivery status: pending, sent, delivered, failed, undelivered';
COMMENT ON COLUMN sms_notifications.cost_cents IS 'Cost in cents (typically ~2 cents USD per SMS)';
COMMENT ON COLUMN sms_notifications.provider_message_id IS 'Twilio Message SID for tracking';
