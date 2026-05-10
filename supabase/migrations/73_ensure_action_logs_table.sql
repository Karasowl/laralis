-- 73. ENSURE ACTION LOGS TABLE
-- Idempotent guard for Lara action audit logs.
-- Keeps new/stage databases from silently missing public.action_logs.

CREATE TABLE IF NOT EXISTS public.action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  user_id uuid,
  action_type text NOT NULL,
  success boolean NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_code text,
  error_message text,
  error_details jsonb,
  dry_run boolean DEFAULT false,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS action_type text;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS success boolean;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS params jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS error_details jsonb;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS dry_run boolean DEFAULT false;
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS executed_at timestamptz DEFAULT now();
ALTER TABLE public.action_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.action_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.action_logs ALTER COLUMN params SET DEFAULT '{}'::jsonb;
ALTER TABLE public.action_logs ALTER COLUMN dry_run SET DEFAULT false;
ALTER TABLE public.action_logs ALTER COLUMN executed_at SET DEFAULT now();
ALTER TABLE public.action_logs ALTER COLUMN created_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.action_logs'::regclass
      AND conname = 'action_logs_clinic_id_fkey'
  ) THEN
    ALTER TABLE public.action_logs
      ADD CONSTRAINT action_logs_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.action_logs'::regclass
      AND conname = 'action_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.action_logs
      ADD CONSTRAINT action_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.action_logs'::regclass
      AND conname = 'action_logs_action_type_check'
  ) THEN
    ALTER TABLE public.action_logs
      ADD CONSTRAINT action_logs_action_type_check
      CHECK (action_type IN (
        'update_service_price',
        'adjust_service_margin',
        'simulate_price_change',
        'create_expense',
        'update_time_settings'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_action_logs_clinic_id ON public.action_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON public.action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_action_type ON public.action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_logs_executed_at ON public.action_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_clinic_executed ON public.action_logs(clinic_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_logs_success ON public.action_logs(success);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view action logs for their clinics" ON public.action_logs;
DROP POLICY IF EXISTS "System can insert action logs" ON public.action_logs;

CREATE POLICY "Users can view action logs for their clinics"
  ON public.action_logs
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id
      FROM public.clinic_users
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    OR
    clinic_id IN (
      SELECT c.id
      FROM public.clinics c
      JOIN public.workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
        AND wu.is_active = true
    )
  );

CREATE POLICY "System can insert action logs"
  ON public.action_logs
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id
      FROM public.clinic_users
      WHERE user_id = auth.uid()
        AND is_active = true
    )
    OR
    clinic_id IN (
      SELECT c.id
      FROM public.clinics c
      JOIN public.workspace_users wu ON wu.workspace_id = c.workspace_id
      WHERE wu.user_id = auth.uid()
        AND wu.is_active = true
    )
  );

COMMENT ON TABLE public.action_logs IS 'Audit trail of all actions executed by Lara AI assistant via Actions System';
COMMENT ON COLUMN public.action_logs.action_type IS 'Type of action executed by the Actions System';
COMMENT ON COLUMN public.action_logs.params IS 'Action parameters as JSONB';
COMMENT ON COLUMN public.action_logs.result IS 'Action result, including before/after state and changes';
COMMENT ON COLUMN public.action_logs.dry_run IS 'True if this was a simulation/preview, false if actually executed';
COMMENT ON COLUMN public.action_logs.executed_at IS 'Timestamp when the action was executed';

GRANT SELECT ON public.action_logs TO authenticated;
GRANT INSERT ON public.action_logs TO authenticated;
GRANT ALL ON public.action_logs TO service_role;

NOTIFY pgrst, 'reload schema';
