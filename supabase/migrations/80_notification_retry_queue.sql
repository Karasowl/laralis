-- Migration 80: Notification Retry Queue
-- Adds a shared retry queue for transient email/SMS provider failures.

CREATE TABLE IF NOT EXISTS notification_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  channel varchar(20) NOT NULL CHECK (channel IN ('email', 'sms')),
  notification_id uuid NOT NULL,

  provider varchar(50),
  provider_message_id varchar(255),

  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'succeeded', 'abandoned', 'cancelled')
  ),
  reason text,
  error_message text,

  retry_count int NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_attempts int NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  processed_at timestamptz,

  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_clinic
  ON notification_retry_queue(clinic_id);

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_due
  ON notification_retry_queue(next_retry_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_channel_notification
  ON notification_retry_queue(channel, notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_status_created
  ON notification_retry_queue(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_retry_queue_active_once
  ON notification_retry_queue(channel, notification_id)
  WHERE status IN ('pending', 'processing');

ALTER TABLE notification_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view notification retries for their clinics"
  ON notification_retry_queue;
CREATE POLICY "Users can view notification retries for their clinics"
  ON notification_retry_queue FOR SELECT
  USING (
    clinic_id IN (
      SELECT c.id
      FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can manage notification retries"
  ON notification_retry_queue;
CREATE POLICY "Service role can manage notification retries"
  ON notification_retry_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_notification_retry_queue_updated_at ON notification_retry_queue;
CREATE TRIGGER update_notification_retry_queue_updated_at
  BEFORE UPDATE ON notification_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE notification_retry_queue IS 'Shared retry queue for transient notification provider failures';
COMMENT ON COLUMN notification_retry_queue.channel IS 'Notification channel that owns notification_id: email or sms';
COMMENT ON COLUMN notification_retry_queue.notification_id IS 'ID in email_notifications or sms_notifications, depending on channel';
COMMENT ON COLUMN notification_retry_queue.retry_count IS 'Number of retry attempts already made by the retry cron, excluding the initial send failure';
COMMENT ON COLUMN notification_retry_queue.next_retry_at IS 'Next time the retry cron may process this row';
