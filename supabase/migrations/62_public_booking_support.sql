-- Migration 62: Public Booking Support
-- Enables public appointment booking via shareable links (no login required)

-- 1. Add slug and booking configuration to clinics
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS slug varchar(100) UNIQUE,
ADD COLUMN IF NOT EXISTS booking_config jsonb DEFAULT '{
  "enabled": false,
  "allow_new_patients": true,
  "require_phone": true,
  "require_notes": false,
  "max_advance_days": 30,
  "min_advance_hours": 2,
  "slot_duration_minutes": 30,
  "working_hours": {
    "monday": {"start": "09:00", "end": "18:00"},
    "tuesday": {"start": "09:00", "end": "18:00"},
    "wednesday": {"start": "09:00", "end": "18:00"},
    "thursday": {"start": "09:00", "end": "18:00"},
    "friday": {"start": "09:00", "end": "18:00"},
    "saturday": null,
    "sunday": null
  },
  "buffer_minutes": 0,
  "welcome_message": null,
  "confirmation_message": null
}'::jsonb;

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_clinics_slug ON clinics(slug) WHERE slug IS NOT NULL;

COMMENT ON COLUMN clinics.slug IS 'URL-friendly identifier for public booking page (e.g., /book/my-clinic)';
COMMENT ON COLUMN clinics.booking_config IS 'Public booking settings: enabled flag, allowed services, working hours, advance booking limits';

-- 2. Create public bookings table (tracks bookings made through public form)
CREATE TABLE IF NOT EXISTS public_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  -- Patient info (may or may not match existing patient)
  patient_name varchar(255) NOT NULL,
  patient_email varchar(255),
  patient_phone varchar(50),
  patient_notes text,

  -- Link to existing patient if found/created
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,

  -- Appointment details
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  requested_date date NOT NULL,
  requested_time time NOT NULL,

  -- Status tracking
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,

  -- Processing info
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id),
  rejection_reason text,

  -- Notifications
  confirmation_email_sent boolean DEFAULT false,
  reminder_email_sent boolean DEFAULT false,

  -- Metadata
  ip_address varchar(45),
  user_agent text,
  referrer text,
  utm_source varchar(100),
  utm_medium varchar(100),
  utm_campaign varchar(100),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_public_bookings_clinic_id ON public_bookings(clinic_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_status ON public_bookings(status);
CREATE INDEX IF NOT EXISTS idx_public_bookings_requested_date ON public_bookings(requested_date);
CREATE INDEX IF NOT EXISTS idx_public_bookings_patient_email ON public_bookings(patient_email) WHERE patient_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_bookings_created_at ON public_bookings(created_at DESC);

-- 3. Services available for public booking (optional whitelist)
-- If empty, all active services are available
CREATE TABLE IF NOT EXISTS public_booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,

  -- Override service duration for booking purposes
  custom_duration_minutes int,

  -- Display order
  display_order int DEFAULT 0,

  -- Active flag
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),

  UNIQUE(clinic_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_public_booking_services_clinic ON public_booking_services(clinic_id);

-- 4. Blocked time slots (holidays, breaks, etc.)
CREATE TABLE IF NOT EXISTS booking_blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  -- Block details
  blocked_date date NOT NULL,
  start_time time,  -- NULL means entire day
  end_time time,
  reason varchar(255),

  -- Recurring blocks
  is_recurring boolean DEFAULT false,
  recurrence_pattern varchar(20) CHECK (recurrence_pattern IN ('weekly', 'monthly', 'yearly')),

  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_blocked_slots_clinic_date ON booking_blocked_slots(clinic_id, blocked_date);

-- 5. RLS Policies

-- Public bookings: Mixed access (public create, authenticated read/update)
ALTER TABLE public_bookings ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT (public booking form)
CREATE POLICY "Anyone can create public bookings"
  ON public_bookings FOR INSERT
  WITH CHECK (true);

-- Clinic owners can view their bookings
CREATE POLICY "Users can view public bookings for their clinics"
  ON public_bookings FOR SELECT
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Clinic owners can update their bookings
CREATE POLICY "Users can update public bookings for their clinics"
  ON public_bookings FOR UPDATE
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Service role can do anything
CREATE POLICY "Service role can manage public bookings"
  ON public_bookings FOR ALL
  USING (auth.role() = 'service_role');

-- Public booking services: Only authenticated users
ALTER TABLE public_booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage booking services for their clinics"
  ON public_booking_services FOR ALL
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage public booking services"
  ON public_booking_services FOR ALL
  USING (auth.role() = 'service_role');

-- Blocked slots: Only authenticated users
ALTER TABLE booking_blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage blocked slots for their clinics"
  ON booking_blocked_slots FOR ALL
  USING (
    clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage blocked slots"
  ON booking_blocked_slots FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Function to generate unique slug from clinic name
CREATE OR REPLACE FUNCTION generate_clinic_slug(clinic_name text, clinic_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(
    regexp_replace(
      unaccent(clinic_name),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  ));

  -- Trim hyphens from ends
  base_slug := trim(both '-' from base_slug);

  -- Truncate to 80 chars to leave room for counter
  base_slug := left(base_slug, 80);

  -- Check for uniqueness, add counter if needed
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM clinics WHERE slug = final_slug AND id != clinic_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 7. Auto-generate slug on clinic creation/update if not set
CREATE OR REPLACE FUNCTION auto_generate_clinic_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if slug is null and booking is being enabled
  IF NEW.slug IS NULL AND
     (NEW.booking_config->>'enabled')::boolean = true THEN
    NEW.slug := generate_clinic_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_slug_on_clinic ON clinics;
CREATE TRIGGER auto_slug_on_clinic
  BEFORE INSERT OR UPDATE OF booking_config
  ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_clinic_slug();

-- 8. Function to check slot availability
CREATE OR REPLACE FUNCTION check_booking_slot_availability(
  p_clinic_id uuid,
  p_date date,
  p_time time,
  p_duration_minutes int DEFAULT 30
)
RETURNS boolean AS $$
DECLARE
  slot_end time;
  is_blocked boolean;
  has_conflict boolean;
BEGIN
  slot_end := p_time + (p_duration_minutes || ' minutes')::interval;

  -- Check blocked slots
  SELECT EXISTS (
    SELECT 1 FROM booking_blocked_slots
    WHERE clinic_id = p_clinic_id
    AND blocked_date = p_date
    AND (
      start_time IS NULL  -- Entire day blocked
      OR (p_time >= start_time AND p_time < end_time)
      OR (slot_end > start_time AND slot_end <= end_time)
    )
  ) INTO is_blocked;

  IF is_blocked THEN
    RETURN false;
  END IF;

  -- Check existing treatments
  SELECT EXISTS (
    SELECT 1 FROM treatments
    WHERE clinic_id = p_clinic_id
    AND treatment_date = p_date
    AND status IN ('scheduled', 'in_progress')
    AND treatment_time IS NOT NULL
    AND (
      (p_time >= treatment_time AND p_time < treatment_time + (COALESCE(duration_minutes, 30) || ' minutes')::interval)
      OR (slot_end > treatment_time AND slot_end <= treatment_time + (COALESCE(duration_minutes, 30) || ' minutes')::interval)
    )
  ) INTO has_conflict;

  IF has_conflict THEN
    RETURN false;
  END IF;

  -- Check pending public bookings (not yet confirmed)
  SELECT EXISTS (
    SELECT 1 FROM public_bookings
    WHERE clinic_id = p_clinic_id
    AND requested_date = p_date
    AND status = 'pending'
    AND (
      (p_time >= requested_time AND p_time < requested_time + (p_duration_minutes || ' minutes')::interval)
      OR (slot_end > requested_time AND slot_end <= requested_time + (p_duration_minutes || ' minutes')::interval)
    )
  ) INTO has_conflict;

  RETURN NOT has_conflict;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public_bookings IS 'Appointment requests made through public booking form (no auth required)';
COMMENT ON TABLE public_booking_services IS 'Services available for public booking (whitelist per clinic)';
COMMENT ON TABLE booking_blocked_slots IS 'Time slots blocked from public booking (holidays, breaks)';
COMMENT ON FUNCTION check_booking_slot_availability IS 'Checks if a time slot is available for booking';
