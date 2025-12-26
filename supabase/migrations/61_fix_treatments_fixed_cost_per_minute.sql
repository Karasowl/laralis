-- Migration: Fix treatments with fixed_cost_per_minute_cents = 0
-- Context: Due to a bug where variable shadowing and nullish coalescing caused
-- treatments to be saved with 0 instead of the calculated value.
--
-- This script recalculates fixed_cost_per_minute_cents for all affected treatments
-- using the formula: total_fixed_costs / effective_minutes_per_month
--
-- Run with: Execute in Supabase SQL Editor

-- Step 1: Create a temporary table with clinic-level calculations
CREATE TEMP TABLE clinic_cost_calculations AS
WITH time_settings AS (
  SELECT
    clinic_id,
    work_days,
    hours_per_day,
    CASE
      WHEN real_pct <= 1 THEN real_pct
      ELSE real_pct / 100
    END as real_pct_factor
  FROM settings_time
),
fixed_costs_sum AS (
  SELECT
    clinic_id,
    COALESCE(SUM(amount_cents), 0) as total_fixed_cents
  FROM fixed_costs
  GROUP BY clinic_id
),
assets_depreciation AS (
  SELECT
    clinic_id,
    COALESCE(SUM(
      CASE
        WHEN depreciation_months > 0 THEN ROUND(purchase_price_cents::numeric / depreciation_months)
        ELSE 0
      END
    ), 0) as monthly_depreciation_cents
  FROM assets
  GROUP BY clinic_id
)
SELECT
  ts.clinic_id,
  ts.work_days,
  ts.hours_per_day,
  ts.real_pct_factor,
  COALESCE(fc.total_fixed_cents, 0) as fixed_costs_cents,
  COALESCE(ad.monthly_depreciation_cents, 0) as depreciation_cents,
  COALESCE(fc.total_fixed_cents, 0) + COALESCE(ad.monthly_depreciation_cents, 0) as total_fixed_monthly_cents,
  -- Calculate effective minutes per month
  CASE
    WHEN ts.work_days > 0 AND ts.hours_per_day > 0 AND ts.real_pct_factor > 0
    THEN ts.work_days * 4 * ts.hours_per_day * 60 * ts.real_pct_factor
    ELSE 0
  END as effective_minutes_per_month,
  -- Calculate cost per minute
  CASE
    WHEN ts.work_days > 0 AND ts.hours_per_day > 0 AND ts.real_pct_factor > 0
    THEN ROUND(
      (COALESCE(fc.total_fixed_cents, 0) + COALESCE(ad.monthly_depreciation_cents, 0))::numeric
      / (ts.work_days * 4 * ts.hours_per_day * 60 * ts.real_pct_factor)
    )
    ELSE 0
  END as calculated_cost_per_minute_cents
FROM time_settings ts
LEFT JOIN fixed_costs_sum fc ON ts.clinic_id = fc.clinic_id
LEFT JOIN assets_depreciation ad ON ts.clinic_id = ad.clinic_id;

-- Step 2: Show what will be updated (preview)
SELECT
  t.id as treatment_id,
  t.clinic_id,
  t.treatment_date,
  s.name as service_name,
  t.fixed_cost_per_minute_cents as current_value,
  ccc.calculated_cost_per_minute_cents as new_value,
  ccc.total_fixed_monthly_cents,
  ccc.effective_minutes_per_month
FROM treatments t
JOIN services s ON t.service_id = s.id
JOIN clinic_cost_calculations ccc ON t.clinic_id = ccc.clinic_id
WHERE t.fixed_cost_per_minute_cents = 0
  AND ccc.calculated_cost_per_minute_cents > 0
ORDER BY t.treatment_date DESC
LIMIT 50;

-- Step 3: Update treatments (UNCOMMENT TO EXECUTE)
-- UPDATE treatments t
-- SET fixed_cost_per_minute_cents = ccc.calculated_cost_per_minute_cents
-- FROM clinic_cost_calculations ccc
-- WHERE t.clinic_id = ccc.clinic_id
--   AND t.fixed_cost_per_minute_cents = 0
--   AND ccc.calculated_cost_per_minute_cents > 0;

-- Step 4: Verify update
-- SELECT
--   COUNT(*) as treatments_still_zero
-- FROM treatments
-- WHERE fixed_cost_per_minute_cents = 0;

-- Cleanup
DROP TABLE IF EXISTS clinic_cost_calculations;

-- IMPORTANT: After running the UPDATE, run this to verify:
-- SELECT clinic_id, COUNT(*) as count, AVG(fixed_cost_per_minute_cents) as avg_cost
-- FROM treatments
-- GROUP BY clinic_id
-- ORDER BY clinic_id;
