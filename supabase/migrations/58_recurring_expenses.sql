-- Migration: Add recurring expenses support
-- File: supabase/migrations/58_recurring_expenses.sql

-- Add columns for recurring expense configuration
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS recurrence_interval varchar(20) DEFAULT NULL
  CHECK (recurrence_interval IN ('weekly', 'monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS recurrence_day integer DEFAULT NULL
  CHECK (recurrence_day >= 1 AND recurrence_day <= 31),
ADD COLUMN IF NOT EXISTS next_recurrence_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS parent_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

-- Comment on columns
COMMENT ON COLUMN public.expenses.recurrence_interval IS
  'Interval for recurring expenses: weekly, monthly, or yearly. NULL if not recurring.';
COMMENT ON COLUMN public.expenses.recurrence_day IS
  'Day of the month (1-31) or week (1-7 for weekly) when expense should recur.';
COMMENT ON COLUMN public.expenses.next_recurrence_date IS
  'Next date when this recurring expense should generate a new entry.';
COMMENT ON COLUMN public.expenses.parent_expense_id IS
  'Reference to the original recurring expense template. NULL if this is the template.';

-- Create index for efficient recurring expense queries
CREATE INDEX IF NOT EXISTS idx_expenses_recurring
  ON public.expenses (clinic_id, is_recurring, next_recurrence_date)
  WHERE is_recurring = true AND next_recurrence_date IS NOT NULL;

-- Function to process recurring expenses for a specific clinic
CREATE OR REPLACE FUNCTION process_recurring_expenses(p_clinic_id uuid DEFAULT NULL)
RETURNS TABLE (
  generated_count integer,
  clinic_id uuid,
  expense_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expense RECORD;
  v_new_id uuid;
  v_count integer := 0;
  v_ids uuid[] := '{}';
  v_next_date date;
BEGIN
  -- Process all recurring expenses due today or earlier
  FOR v_expense IN
    SELECT e.*
    FROM public.expenses e
    WHERE e.is_recurring = true
      AND e.next_recurrence_date IS NOT NULL
      AND e.next_recurrence_date <= CURRENT_DATE
      AND e.parent_expense_id IS NULL  -- Only process templates, not generated copies
      AND (p_clinic_id IS NULL OR e.clinic_id = p_clinic_id)
    ORDER BY e.next_recurrence_date
  LOOP
    -- Create new expense entry
    INSERT INTO public.expenses (
      clinic_id,
      expense_date,
      category_id,
      category,
      subcategory,
      description,
      amount_cents,
      vendor,
      invoice_number,
      is_recurring,
      is_variable,
      expense_category,
      campaign_id,
      related_supply_id,
      quantity,
      notes,
      parent_expense_id
    ) VALUES (
      v_expense.clinic_id,
      v_expense.next_recurrence_date,
      v_expense.category_id,
      v_expense.category,
      v_expense.subcategory,
      v_expense.description,
      v_expense.amount_cents,
      v_expense.vendor,
      v_expense.invoice_number,
      false,  -- Generated expenses are NOT templates
      v_expense.is_variable,
      v_expense.expense_category,
      v_expense.campaign_id,
      v_expense.related_supply_id,
      v_expense.quantity,
      COALESCE(v_expense.notes, '') || ' [Auto-generated from recurring expense]',
      v_expense.id  -- Reference to parent template
    )
    RETURNING id INTO v_new_id;

    v_ids := array_append(v_ids, v_new_id);
    v_count := v_count + 1;

    -- Calculate next recurrence date
    v_next_date := CASE v_expense.recurrence_interval
      WHEN 'weekly' THEN v_expense.next_recurrence_date + INTERVAL '7 days'
      WHEN 'monthly' THEN
        -- Handle month-end edge cases (e.g., Jan 31 -> Feb 28)
        LEAST(
          (v_expense.next_recurrence_date + INTERVAL '1 month')::date,
          (date_trunc('month', v_expense.next_recurrence_date + INTERVAL '1 month')
           + (COALESCE(v_expense.recurrence_day, EXTRACT(DAY FROM v_expense.expense_date)::integer) - 1) * INTERVAL '1 day')::date
        )
      WHEN 'yearly' THEN v_expense.next_recurrence_date + INTERVAL '1 year'
      ELSE v_expense.next_recurrence_date + INTERVAL '1 month'  -- Default to monthly
    END;

    -- Update template with next recurrence date
    UPDATE public.expenses
    SET next_recurrence_date = v_next_date,
        updated_at = NOW()
    WHERE id = v_expense.id;
  END LOOP;

  RETURN QUERY SELECT v_count, p_clinic_id, v_ids;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_recurring_expenses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION process_recurring_expenses(uuid) TO service_role;

-- Optional: Enable pg_cron extension if available (Supabase Pro feature)
-- This would run daily at 1:00 AM UTC
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('process-recurring-expenses', '0 1 * * *', 'SELECT process_recurring_expenses(NULL)');
