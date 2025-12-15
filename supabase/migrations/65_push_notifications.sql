-- Migration 65: Web Push Notifications Support
-- Created: 2025-12-14
-- Description: Tables for Web Push API subscriptions and notification delivery tracking

-- Push subscriptions table: Stores browser push notification endpoints
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Push subscription details
  endpoint text NOT NULL,
  expiration_time timestamptz,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,

  -- Device metadata
  user_agent text,
  device_name varchar(255),

  -- Status tracking
  is_active boolean DEFAULT true,
  last_used_at timestamptz DEFAULT now(),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- One subscription per user per endpoint
  UNIQUE(user_id, endpoint)
);

-- Notification delivery log
CREATE TABLE IF NOT EXISTS push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES push_subscriptions(id) ON DELETE SET NULL,

  -- Notification content
  notification_type varchar(50) NOT NULL, -- 'appointment_reminder', 'treatment_created', etc.
  title varchar(255) NOT NULL,
  body text NOT NULL,
  icon_url text,
  action_url text,

  -- Delivery tracking
  status varchar(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'clicked'
  sent_at timestamptz,
  clicked_at timestamptz,
  error_message text,

  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_clinic ON push_subscriptions(clinic_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;

CREATE INDEX idx_push_notifications_subscription ON push_notifications(subscription_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_created ON push_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for push_notifications
CREATE POLICY "Users can view notifications for their subscriptions"
  ON push_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM push_subscriptions
      WHERE push_subscriptions.id = push_notifications.subscription_id
      AND push_subscriptions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all push notifications"
  ON push_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update last_used_at on push_subscriptions
CREATE OR REPLACE FUNCTION update_push_subscription_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE push_subscriptions
  SET last_used_at = now()
  WHERE id = NEW.subscription_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_used_at when notification is sent
CREATE TRIGGER trigger_update_push_subscription_last_used
  AFTER INSERT ON push_notifications
  FOR EACH ROW
  WHEN (NEW.sent_at IS NOT NULL)
  EXECUTE FUNCTION update_push_subscription_last_used();

-- Comments
COMMENT ON TABLE push_subscriptions IS 'Stores Web Push API subscription endpoints for browser notifications';
COMMENT ON TABLE push_notifications IS 'Tracks delivery status of push notifications sent to subscribed clients';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Push service endpoint URL (unique per browser/device)';
COMMENT ON COLUMN push_subscriptions.keys_p256dh IS 'Public key for P-256 ECDH encryption';
COMMENT ON COLUMN push_subscriptions.keys_auth IS 'Authentication secret for encrypted payloads';
COMMENT ON COLUMN push_notifications.notification_type IS 'Category of notification: appointment_reminder, treatment_created, etc.';
