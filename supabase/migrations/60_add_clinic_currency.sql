-- Migration: Add currency configuration to clinics
-- Date: 2025-12-10
-- Description: Allows each clinic to configure their preferred currency and locale.
--              This enables support for clinics in different countries (MXN, USD, COP, ARS, EUR, etc.)

-- Add currency field (ISO 4217 code, 3 chars)
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'MXN';

-- Add locale field for number/date formatting
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS locale varchar(10) DEFAULT 'es-MX';

-- Add comments for documentation
COMMENT ON COLUMN public.clinics.currency IS
  'ISO 4217 currency code (e.g., MXN, USD, COP, ARS, EUR). Used for displaying monetary values.';

COMMENT ON COLUMN public.clinics.locale IS
  'Locale code for number/date formatting (e.g., es-MX, en-US, es-CO). Determines decimal separator, date format, etc.';

-- Verify the columns were added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'clinics'
    AND column_name = 'currency'
  ) THEN
    RAISE EXCEPTION 'Column currency was not added to clinics table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'clinics'
    AND column_name = 'locale'
  ) THEN
    RAISE EXCEPTION 'Column locale was not added to clinics table';
  END IF;

  RAISE NOTICE 'Currency and locale columns added successfully to clinics table';
END $$;
