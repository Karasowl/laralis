-- Keep public booking availability aligned with the current treatments schema.
-- The treatments table stores duration in minutes, not duration_minutes.

CREATE OR REPLACE FUNCTION public.check_booking_slot_availability(
  p_clinic_id uuid,
  p_date date,
  p_time time without time zone,
  p_duration_minutes integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot_end time;
  is_blocked boolean;
  has_conflict boolean;
BEGIN
  slot_end := p_time + (p_duration_minutes || ' minutes')::interval;

  SELECT EXISTS (
    SELECT 1
    FROM public.booking_blocked_slots
    WHERE clinic_id = p_clinic_id
      AND blocked_date = p_date
      AND (
        start_time IS NULL
        OR (p_time >= start_time AND p_time < end_time)
        OR (slot_end > start_time AND slot_end <= end_time)
      )
  ) INTO is_blocked;

  IF is_blocked THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.treatments
    WHERE clinic_id = p_clinic_id
      AND treatment_date = p_date
      AND status IN ('scheduled', 'in_progress')
      AND treatment_time IS NOT NULL
      AND (
        (p_time >= treatment_time AND p_time < treatment_time + (COALESCE(minutes, 30) || ' minutes')::interval)
        OR (slot_end > treatment_time AND slot_end <= treatment_time + (COALESCE(minutes, 30) || ' minutes')::interval)
      )
  ) INTO has_conflict;

  IF has_conflict THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.public_bookings
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
$$;

GRANT EXECUTE ON FUNCTION public.check_booking_slot_availability(uuid, date, time without time zone, integer) TO anon, authenticated, service_role;
