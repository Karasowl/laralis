-- Migration 55: Add unique constraint for patients (clinic_id + first_name + last_name)
-- This prevents duplicate patients with the same name in the same clinic
--
-- IMPORTANT: Before running this migration, check for existing duplicates:
-- SELECT clinic_id, first_name, last_name, COUNT(*) as count
-- FROM patients
-- WHERE first_name IS NOT NULL AND last_name IS NOT NULL
-- GROUP BY clinic_id, first_name, last_name
-- HAVING COUNT(*) > 1;
--
-- If duplicates exist, merge them first using the patients management UI.

-- Step 1: Create a function to normalize names for comparison (lowercase, trim)
CREATE OR REPLACE FUNCTION normalize_patient_name(name text)
RETURNS text AS $$
BEGIN
  RETURN LOWER(TRIM(COALESCE(name, '')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Create unique index with normalized names
-- Using a unique index instead of constraint allows for the function-based normalization
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_unique_name_per_clinic
ON patients (
  clinic_id,
  normalize_patient_name(first_name),
  normalize_patient_name(last_name)
)
WHERE first_name IS NOT NULL AND last_name IS NOT NULL;

-- Step 3: Add a comment explaining the constraint
COMMENT ON INDEX idx_patients_unique_name_per_clinic IS
'Prevents duplicate patients with the same normalized name (case-insensitive) within a clinic.
If you need two patients with the same name (e.g., father/son), differentiate them like "Juan García" vs "Juan García Jr"';

-- Step 4: Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 55: Added unique patient name constraint per clinic';
END $$;
