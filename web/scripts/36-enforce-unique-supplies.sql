-- Enforce unique supply names per clinic (case-insensitive)
-- 1) Consolidate duplicates moving usages to a canonical record
-- 2) Delete the extra rows
-- 3) Create a unique index on (clinic_id, lower(name))

BEGIN;

-- Map duplicates to a canonical supply (keep MIN(id) per clinic+name)
WITH canonical AS (
  SELECT clinic_id, lower(name) AS lname, MIN(id) AS keep_id
  FROM supplies
  GROUP BY clinic_id, lower(name)
  HAVING COUNT(*) > 1
), dups AS (
  SELECT s.id AS dup_id, c.keep_id
  FROM supplies s
  JOIN canonical c
    ON c.clinic_id = s.clinic_id AND lower(s.name) = c.lname
  WHERE s.id <> c.keep_id
)
-- Repoint service_supplies to the kept id
UPDATE service_supplies ss
SET supply_id = d.keep_id
FROM dups d
WHERE ss.supply_id = d.dup_id;

-- Remove duplicate supply rows
DELETE FROM supplies s
USING dups d
WHERE s.id = d.dup_id;

-- Create the unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS supplies_unique_name_per_clinic
  ON supplies (clinic_id, lower(name));

COMMIT;

