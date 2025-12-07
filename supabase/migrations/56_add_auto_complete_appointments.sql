-- Migration: Add auto_complete_appointments setting to clinics
-- Date: 2025-12-07
-- Description: Adds a boolean field to clinics table to control automatic
--              completion of appointments at midnight. Default is FALSE (manual).

-- Add the column with default FALSE (manual mode)
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS auto_complete_appointments BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.clinics.auto_complete_appointments IS
  'If TRUE, past appointments are automatically marked as completed at midnight. If FALSE (default), user must manually mark them as completed.';

-- Create index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_clinics_auto_complete
ON public.clinics(auto_complete_appointments)
WHERE auto_complete_appointments = TRUE;
