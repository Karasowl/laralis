-- Migration: Add expense categorization (variable vs fixed) and category field
-- Purpose: Enable proper financial analysis (Gross Profit, Operating Profit, EBITDA)
-- Date: 2025-11-22

-- Add new columns to expenses table
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_variable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expense_category VARCHAR(50);

-- Add comment explaining the fields
COMMENT ON COLUMN expenses.is_variable IS 'True if expense is variable (materials, lab fees), false if fixed (rent, salaries, utilities)';
COMMENT ON COLUMN expenses.expense_category IS 'Category of expense: materials, lab_fees, rent, salaries, utilities, insurance, software, marketing, other';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_is_variable ON expenses(is_variable);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(expense_category);

-- Update existing data: Set reasonable defaults based on common patterns
-- This is a best-effort categorization - users should review and update
UPDATE expenses
SET is_variable = false,
    expense_category = 'other'
WHERE is_variable IS NULL;

-- Note: Users should manually categorize their expenses after this migration
-- Common categories:
-- Variable: 'materials', 'lab_fees', 'supplies_dental'
-- Fixed: 'rent', 'salaries', 'utilities', 'insurance', 'software_subscriptions', 'marketing', 'maintenance'
