-- Migration 61: Email Notifications System
-- Adds tables for email notifications (confirmations and reminders)

-- 1. Clinic notification settings (extends clinics table)
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{
  "email_enabled": true,
  "confirmation_enabled": true,
  "reminder_enabled": true,
  "reminder_hours_before": 24,
  "sender_name": null,
  "reply_to_email": null
}'::jsonb;

COMMENT ON COLUMN clinics.notification_settings IS 'Email notification preferences: confirmation/reminder toggles, timing, sender info';

-- 2. Email notification log table
CREATE TABLE IF NOT EXISTS email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,

  -- Email details
  notification_type varchar(50) NOT NULL CHECK (notification_type IN ('confirmation', 'reminder', 'cancellation', 'reschedule')),
  recipient_email varchar(255) NOT NULL,
  recipient_name varchar(255),
  subject varchar(500) NOT NULL,

  -- Status tracking
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'opened')),
  sent_at timestamptz,
  opened_at timestamptz,
  error_message text,

  -- Provider details (for debugging)
  provider varchar(50) DEFAULT 'resend',
  provider_message_id varchar(255),

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_notifications_clinic_id ON email_notifications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_treatment_id ON email_notifications(treatment_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created_at ON email_notifications(created_at DESC);

-- 3. Scheduled reminders queue (for cron job processing)
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Scheduling
  scheduled_for timestamptz NOT NULL,
  reminder_type varchar(20) NOT NULL DEFAULT '24h' CHECK (reminder_type IN ('24h', '48h', '1h', 'custom')),

  -- Status
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  processed_at timestamptz,
  email_notification_id uuid REFERENCES email_notifications(id),

  -- Metadata
  created_at timestamptz DEFAULT now(),

  -- Unique constraint to prevent duplicate reminders
  UNIQUE(treatment_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_scheduled_for ON scheduled_reminders(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_clinic_id ON scheduled_reminders(clinic_id);

-- 4. RLS Policies
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- Email notifications: Users can view notifications for their clinics
CREATE POLICY "Users can view email notifications for their clinics"
  ON email_notifications FOR SELECT
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Email notifications: Service role can insert/update (for API routes)
CREATE POLICY "Service role can manage email notifications"
  ON email_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- Scheduled reminders: Same policies
CREATE POLICY "Users can view scheduled reminders for their clinics"
  ON scheduled_reminders FOR SELECT
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage scheduled reminders"
  ON scheduled_reminders FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Function to create reminder when treatment is scheduled
CREATE OR REPLACE FUNCTION create_treatment_reminder()
RETURNS TRIGGER AS $$
DECLARE
  clinic_settings jsonb;
  reminder_hours int;
  treatment_datetime timestamptz;
  reminder_datetime timestamptz;
BEGIN
  -- Only for scheduled treatments with a future date
  IF NEW.status = 'scheduled' AND NEW.treatment_date >= CURRENT_DATE THEN
    -- Get clinic notification settings
    SELECT notification_settings INTO clinic_settings
    FROM clinics WHERE id = NEW.clinic_id;

    -- Check if reminders are enabled
    IF (clinic_settings->>'reminder_enabled')::boolean = true THEN
      -- Get reminder hours (default 24)
      reminder_hours := COALESCE((clinic_settings->>'reminder_hours_before')::int, 24);

      -- Calculate treatment datetime (use noon if no time specified)
      treatment_datetime := (NEW.treatment_date || ' ' || COALESCE(NEW.treatment_time::text, '12:00:00'))::timestamptz;

      -- Calculate reminder datetime
      reminder_datetime := treatment_datetime - (reminder_hours || ' hours')::interval;

      -- Only create reminder if it's in the future
      IF reminder_datetime > now() THEN
        INSERT INTO scheduled_reminders (
          clinic_id,
          treatment_id,
          patient_id,
          scheduled_for,
          reminder_type
        ) VALUES (
          NEW.clinic_id,
          NEW.id,
          NEW.patient_id,
          reminder_datetime,
          CASE
            WHEN reminder_hours = 24 THEN '24h'
            WHEN reminder_hours = 48 THEN '48h'
            WHEN reminder_hours = 1 THEN '1h'
            ELSE 'custom'
          END
        )
        ON CONFLICT (treatment_id, reminder_type) DO UPDATE
        SET scheduled_for = EXCLUDED.scheduled_for,
            status = 'pending',
            processed_at = NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger for automatic reminder creation
DROP TRIGGER IF EXISTS create_reminder_on_treatment ON treatments;
CREATE TRIGGER create_reminder_on_treatment
  AFTER INSERT OR UPDATE OF treatment_date, treatment_time, status
  ON treatments
  FOR EACH ROW
  EXECUTE FUNCTION create_treatment_reminder();

-- 7. Function to cancel reminders when treatment is cancelled/completed
CREATE OR REPLACE FUNCTION cancel_treatment_reminder()
RETURNS TRIGGER AS $$
BEGIN
  -- Cancel pending reminders when treatment is no longer scheduled
  IF NEW.status IN ('completed', 'cancelled', 'no_show') AND OLD.status = 'scheduled' THEN
    UPDATE scheduled_reminders
    SET status = 'cancelled', processed_at = now()
    WHERE treatment_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS cancel_reminder_on_treatment_update ON treatments;
CREATE TRIGGER cancel_reminder_on_treatment_update
  AFTER UPDATE OF status
  ON treatments
  FOR EACH ROW
  EXECUTE FUNCTION cancel_treatment_reminder();

-- Comments
COMMENT ON TABLE email_notifications IS 'Log of all email notifications sent (confirmations, reminders, etc.)';
COMMENT ON TABLE scheduled_reminders IS 'Queue of upcoming appointment reminders to be processed by cron';
