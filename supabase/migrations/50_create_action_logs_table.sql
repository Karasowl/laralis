-- Migration 50: Create action_logs table for Actions System audit trail
-- Author: Claude (Actions System)
-- Date: 2025-11-20
-- Description: Persistent logging of all actions executed by Lara AI assistant

-- =============================================================================
-- TABLE: action_logs
-- =============================================================================
-- Stores audit trail of all actions executed via the Actions System
-- Used for compliance, debugging, and user transparency

CREATE TABLE IF NOT EXISTS action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Action details
  action_type text NOT NULL CHECK (action_type IN (
    'update_service_price',
    'adjust_service_margin',
    'simulate_price_change',
    'create_expense',
    'update_time_settings'
  )),

  -- Execution status
  success boolean NOT NULL,

  -- Action parameters (JSONB for flexibility)
  params jsonb NOT NULL,

  -- Results (JSONB for flexibility)
  result jsonb, -- Contains before/after state, changes, etc.

  -- Error details (if success = false)
  error_code text,
  error_message text,
  error_details jsonb,

  -- Context
  dry_run boolean DEFAULT false,
  executed_at timestamptz NOT NULL DEFAULT now(),

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Indexes for performance
  CONSTRAINT action_logs_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT action_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index for querying by clinic (most common query pattern)
CREATE INDEX idx_action_logs_clinic_id ON action_logs(clinic_id);

-- Index for querying by user
CREATE INDEX idx_action_logs_user_id ON action_logs(user_id);

-- Index for querying by action type
CREATE INDEX idx_action_logs_action_type ON action_logs(action_type);

-- Index for querying by execution time (for time-based queries)
CREATE INDEX idx_action_logs_executed_at ON action_logs(executed_at DESC);

-- Composite index for clinic + time range queries (common pattern)
CREATE INDEX idx_action_logs_clinic_executed ON action_logs(clinic_id, executed_at DESC);

-- Index for filtering by success status
CREATE INDEX idx_action_logs_success ON action_logs(success);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view action logs for their clinics
CREATE POLICY "Users can view action logs for their clinics"
  ON action_logs
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id
      FROM clinic_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert action logs
CREATE POLICY "System can insert action logs"
  ON action_logs
  FOR INSERT
  WITH CHECK (
    -- User must be member of the clinic
    clinic_id IN (
      SELECT clinic_id
      FROM clinic_memberships
      WHERE user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies - logs are immutable

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE action_logs IS 'Audit trail of all actions executed by Lara AI assistant via Actions System';
COMMENT ON COLUMN action_logs.action_type IS 'Type of action executed (matches ActionType enum)';
COMMENT ON COLUMN action_logs.params IS 'Action parameters as JSONB (flexible schema)';
COMMENT ON COLUMN action_logs.result IS 'Action result including before/after state and changes list';
COMMENT ON COLUMN action_logs.error_code IS 'Error code if action failed (e.g., SERVICE_NOT_FOUND, VALIDATION_ERROR)';
COMMENT ON COLUMN action_logs.dry_run IS 'True if this was a simulation/preview, false if actually executed';
COMMENT ON COLUMN action_logs.executed_at IS 'Timestamp when action was executed (may differ from created_at)';

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Grant access to authenticated users (RLS will control row-level access)
GRANT SELECT ON action_logs TO authenticated;
GRANT INSERT ON action_logs TO authenticated;

-- Service role has full access (for backend operations)
GRANT ALL ON action_logs TO service_role;
