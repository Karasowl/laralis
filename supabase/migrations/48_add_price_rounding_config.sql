-- Migration 48: Add price rounding configuration to clinics
-- This allows clinics to configure automatic price rounding (e.g., round to nearest 10, 50, 100)
-- Similar to the old tariffs system's "roundTo" feature

-- Add price_rounding column to clinics table
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS price_rounding INTEGER DEFAULT 10 CHECK (price_rounding > 0);

-- Update existing clinics to have default rounding of 10 pesos
UPDATE public.clinics SET price_rounding = 10 WHERE price_rounding IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.clinics.price_rounding IS 'Automatic price rounding configuration (in pesos). Prices will be rounded to the nearest multiple of this value. Default: 10 (rounds to $10, $20, $30, etc.)';
