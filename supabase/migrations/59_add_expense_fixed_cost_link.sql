-- Migration: Link expenses to fixed costs for budget tracking
-- Date: 2025-12-10
-- Description: Adds related_fixed_cost_id to expenses table to track actual vs planned spending.
--              This allows comparing registered expenses against their planned fixed cost budget.

-- Add foreign key column to link expenses to fixed_costs
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS related_fixed_cost_id uuid REFERENCES public.fixed_costs(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.expenses.related_fixed_cost_id IS
  'Reference to the planned fixed cost this expense is associated with. Used for budget vs actual analysis.';

-- Create index for efficient queries on fixed cost relations
CREATE INDEX IF NOT EXISTS idx_expenses_related_fixed_cost
  ON public.expenses (clinic_id, related_fixed_cost_id)
  WHERE related_fixed_cost_id IS NOT NULL;

-- Create a view for budget vs actual analysis per fixed cost
CREATE OR REPLACE VIEW public.fixed_cost_budget_analysis AS
SELECT
  fc.id AS fixed_cost_id,
  fc.clinic_id,
  fc.category,
  fc.concept,
  fc.amount_cents AS planned_monthly_cents,
  fc.is_active,
  COALESCE(
    (
      SELECT SUM(e.amount_cents)
      FROM public.expenses e
      WHERE e.related_fixed_cost_id = fc.id
        AND e.expense_date >= date_trunc('month', CURRENT_DATE)
        AND e.expense_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    ),
    0
  ) AS actual_this_month_cents,
  COALESCE(
    (
      SELECT COUNT(*)
      FROM public.expenses e
      WHERE e.related_fixed_cost_id = fc.id
        AND e.expense_date >= date_trunc('month', CURRENT_DATE)
        AND e.expense_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
    ),
    0
  ) AS expense_count_this_month
FROM public.fixed_costs fc;

-- Grant access to the view
GRANT SELECT ON public.fixed_cost_budget_analysis TO authenticated;
GRANT SELECT ON public.fixed_cost_budget_analysis TO service_role;

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'related_fixed_cost_id'
  ) THEN
    RAISE EXCEPTION 'Column related_fixed_cost_id was not added successfully';
  END IF;

  RAISE NOTICE 'Migration 59: related_fixed_cost_id column and budget analysis view added successfully';
END $$;
