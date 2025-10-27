-- Add notes column to expenses table
-- This column allows users to add optional free-text notes to expense records

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS notes text;

-- Add comment to describe the column
COMMENT ON COLUMN expenses.notes IS 'Optional free-text notes for additional expense details';

-- Also add campaign_id and auto_processed columns if they don't exist
-- These are used for marketing campaign tracking and automation flags

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES marketing_campaigns(id);

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS auto_processed boolean DEFAULT false;

-- Add comments for new columns
COMMENT ON COLUMN expenses.campaign_id IS 'Reference to marketing campaign if expense is marketing-related';
COMMENT ON COLUMN expenses.auto_processed IS 'Flag indicating if expense was automatically processed (e.g., supply inventory update)';

-- Create index for campaign_id for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_campaign_id ON expenses(campaign_id) WHERE campaign_id IS NOT NULL;