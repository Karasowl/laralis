-- Migration 63: WhatsApp Notifications Support
-- Adds WhatsApp configuration and notification logging

-- 1. Extend notification_settings in clinics to include WhatsApp config
-- The existing notification_settings JSONB will be extended with whatsapp config
COMMENT ON COLUMN clinics.notification_settings IS 'Notification preferences including email and WhatsApp settings';

-- 2. Create WhatsApp message templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  -- Template identification
  name varchar(100) NOT NULL,
  template_type varchar(50) NOT NULL CHECK (template_type IN (
    'appointment_confirmation',
    'appointment_reminder',
    'appointment_cancelled',
    'appointment_rescheduled',
    'booking_received',
    'booking_confirmed',
    'custom'
  )),

  -- Content (with placeholders like {{patient_name}}, {{date}}, {{time}})
  content text NOT NULL,
  language varchar(10) DEFAULT 'es',

  -- Provider template ID (if using pre-approved templates)
  provider_template_id varchar(255),
  provider varchar(50) DEFAULT 'twilio',

  -- Status
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(clinic_id, template_type, language)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_clinic ON whatsapp_templates(clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_type ON whatsapp_templates(template_type);

-- 3. Create WhatsApp message log table
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  public_booking_id uuid REFERENCES public_bookings(id) ON DELETE SET NULL,

  -- Message details
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
  template_id uuid REFERENCES whatsapp_templates(id),

  -- Status tracking
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed',
    'undelivered'
  )),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,

  -- Provider details
  provider varchar(50) DEFAULT 'twilio',
  provider_message_id varchar(255),
  provider_status varchar(50),

  -- Cost tracking (in cents)
  cost_cents int DEFAULT 0,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_clinic ON whatsapp_notifications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_treatment ON whatsapp_notifications(treatment_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_patient ON whatsapp_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_status ON whatsapp_notifications(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_created ON whatsapp_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_provider_id ON whatsapp_notifications(provider_message_id);

-- 4. RLS Policies
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Templates: Clinic owners can manage
CREATE POLICY "Users can manage whatsapp templates for their clinics"
  ON whatsapp_templates FOR ALL
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage whatsapp templates"
  ON whatsapp_templates FOR ALL
  USING (auth.role() = 'service_role');

-- Notifications: Clinic owners can view
CREATE POLICY "Users can view whatsapp notifications for their clinics"
  ON whatsapp_notifications FOR SELECT
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage whatsapp notifications"
  ON whatsapp_notifications FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Insert default templates for new clinics (trigger)
CREATE OR REPLACE FUNCTION create_default_whatsapp_templates()
RETURNS TRIGGER AS $$
BEGIN
  -- Spanish templates
  INSERT INTO whatsapp_templates (clinic_id, name, template_type, content, language) VALUES
    (NEW.id, 'Confirmación de Cita', 'appointment_confirmation',
     'Hola {{patient_name}}, tu cita en {{clinic_name}} ha sido confirmada para el {{date}} a las {{time}}. Servicio: {{service_name}}. Te esperamos!', 'es'),
    (NEW.id, 'Recordatorio de Cita', 'appointment_reminder',
     'Hola {{patient_name}}, te recordamos que tienes una cita {{time_until}} en {{clinic_name}}. Fecha: {{date}} a las {{time}}. Te esperamos!', 'es'),
    (NEW.id, 'Cita Cancelada', 'appointment_cancelled',
     'Hola {{patient_name}}, lamentamos informarte que tu cita del {{date}} a las {{time}} en {{clinic_name}} ha sido cancelada. Contáctanos para reagendar.', 'es'),
    (NEW.id, 'Solicitud Recibida', 'booking_received',
     'Hola {{patient_name}}, hemos recibido tu solicitud de cita en {{clinic_name}} para el {{date}} a las {{time}}. Te confirmaremos pronto.', 'es'),
    (NEW.id, 'Reserva Confirmada', 'booking_confirmed',
     'Hola {{patient_name}}, tu solicitud de cita en {{clinic_name}} ha sido confirmada! Te esperamos el {{date}} a las {{time}}.', 'es');

  -- English templates
  INSERT INTO whatsapp_templates (clinic_id, name, template_type, content, language) VALUES
    (NEW.id, 'Appointment Confirmation', 'appointment_confirmation',
     'Hi {{patient_name}}, your appointment at {{clinic_name}} has been confirmed for {{date}} at {{time}}. Service: {{service_name}}. See you there!', 'en'),
    (NEW.id, 'Appointment Reminder', 'appointment_reminder',
     'Hi {{patient_name}}, this is a reminder that you have an appointment {{time_until}} at {{clinic_name}}. Date: {{date}} at {{time}}. See you there!', 'en'),
    (NEW.id, 'Appointment Cancelled', 'appointment_cancelled',
     'Hi {{patient_name}}, we regret to inform you that your appointment on {{date}} at {{time}} at {{clinic_name}} has been cancelled. Contact us to reschedule.', 'en'),
    (NEW.id, 'Booking Received', 'booking_received',
     'Hi {{patient_name}}, we have received your appointment request at {{clinic_name}} for {{date}} at {{time}}. We will confirm shortly.', 'en'),
    (NEW.id, 'Booking Confirmed', 'booking_confirmed',
     'Hi {{patient_name}}, your appointment request at {{clinic_name}} has been confirmed! See you on {{date}} at {{time}}.', 'en')
  ON CONFLICT (clinic_id, template_type, language) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_whatsapp_templates_on_clinic ON clinics;
CREATE TRIGGER create_whatsapp_templates_on_clinic
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION create_default_whatsapp_templates();

-- 6. Function to format phone numbers for WhatsApp (E.164 format)
CREATE OR REPLACE FUNCTION format_whatsapp_phone(phone text, default_country_code text DEFAULT '52')
RETURNS text AS $$
DECLARE
  cleaned text;
BEGIN
  -- Remove all non-numeric characters
  cleaned := regexp_replace(phone, '[^0-9]', '', 'g');

  -- If starts with 0, remove it
  IF left(cleaned, 1) = '0' THEN
    cleaned := substring(cleaned from 2);
  END IF;

  -- If doesn't start with country code (less than 11 digits for Mexico), add it
  IF length(cleaned) <= 10 THEN
    cleaned := default_country_code || cleaned;
  END IF;

  -- Add whatsapp: prefix
  RETURN 'whatsapp:+' || cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments
COMMENT ON TABLE whatsapp_templates IS 'WhatsApp message templates per clinic with placeholder support';
COMMENT ON TABLE whatsapp_notifications IS 'Log of all WhatsApp notifications sent with delivery status tracking';
COMMENT ON FUNCTION format_whatsapp_phone IS 'Formats phone numbers to WhatsApp E.164 format with country code';
