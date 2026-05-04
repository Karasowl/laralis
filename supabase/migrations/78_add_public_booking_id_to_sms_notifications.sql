-- Migration 78: Link SMS notifications to public bookings
-- Allows booking request SMS mocks and real SMS logs to be traced back to public_bookings.

ALTER TABLE sms_notifications
ADD COLUMN IF NOT EXISTS public_booking_id uuid REFERENCES public_bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sms_notifications_public_booking
  ON sms_notifications(public_booking_id);

COMMENT ON COLUMN sms_notifications.public_booking_id IS 'Public booking request associated with this SMS notification, when applicable';
