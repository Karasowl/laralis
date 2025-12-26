-- Migration: 69_create_snapshot_system.sql
-- Description: Create snapshot system for per-clinic backups
-- Features:
--   - Dynamic table discovery functions
--   - Snapshot metadata table
--   - RLS policies (only owner can manage snapshots)
--   - Storage bucket setup (run separately in Supabase dashboard)

-- ============================================================================
-- 1. Discovery Functions
-- ============================================================================

-- Function to discover all tables with clinic_id column
CREATE OR REPLACE FUNCTION discover_clinic_tables()
RETURNS TABLE (
  table_name text,
  is_nullable boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    c.table_name::text,
    c.is_nullable = 'YES' as is_nullable
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON c.table_name = t.table_name
    AND c.table_schema = t.table_schema
  WHERE c.table_schema = 'public'
    AND c.column_name = 'clinic_id'
    AND t.table_type = 'BASE TABLE'
    AND c.table_name NOT LIKE '\_%'
    AND c.table_name NOT LIKE 'pg_%'
    AND c.table_name NOT IN ('schema_migrations', 'supabase_migrations', 'tariffs')
  ORDER BY c.table_name;
$$;

COMMENT ON FUNCTION discover_clinic_tables() IS
'Discovers all tables with clinic_id column for snapshot system. Uses information_schema for dynamic discovery.';

-- Function to get all columns for a table
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    column_name::text,
    data_type::text,
    is_nullable = 'YES',
    column_default::text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table_name
  ORDER BY ordinal_position;
$$;

COMMENT ON FUNCTION get_table_columns(text) IS
'Returns all columns for a given table. Used for snapshot manifest generation.';

-- Function to get foreign key relationships
CREATE OR REPLACE FUNCTION get_table_foreign_keys(p_table_name text)
RETURNS TABLE (
  constraint_name text,
  column_name text,
  foreign_table text,
  foreign_column text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    tc.constraint_name::text,
    kcu.column_name::text,
    ccu.table_name::text AS foreign_table,
    ccu.column_name::text AS foreign_column
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = p_table_name
    AND tc.table_schema = 'public';
$$;

COMMENT ON FUNCTION get_table_foreign_keys(text) IS
'Returns all foreign key relationships for a given table. Used for calculating insertion order.';

-- ============================================================================
-- 2. Snapshot Metadata Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS clinic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Snapshot type
  type varchar(20) NOT NULL CHECK (type IN ('manual', 'scheduled', 'pre-restore')),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),

  -- Storage info
  storage_path text NOT NULL,
  checksum text NOT NULL,

  -- Size tracking
  compressed_size_bytes bigint,
  uncompressed_size_bytes bigint,

  -- Content metadata
  record_counts jsonb NOT NULL DEFAULT '{}',
  table_manifest jsonb NOT NULL DEFAULT '[]',
  schema_version integer NOT NULL,
  app_version text DEFAULT '1.0.0',

  -- Retention
  retention_days integer NOT NULL DEFAULT 30,
  expires_at timestamptz GENERATED ALWAYS AS (created_at + (retention_days || ' days')::interval) STORED,

  -- Error handling
  error_message text,

  -- Additional metadata
  metadata jsonb DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clinic_snapshots_clinic_id
ON clinic_snapshots(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_snapshots_expires_at
ON clinic_snapshots(expires_at)
WHERE expires_at IS NOT NULL AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_clinic_snapshots_type
ON clinic_snapshots(type, status);

-- Comments
COMMENT ON TABLE clinic_snapshots IS
'Stores metadata for clinic-level snapshots. Actual snapshot data is stored in Supabase Storage.';

COMMENT ON COLUMN clinic_snapshots.type IS
'manual = user-created, scheduled = cron job, pre-restore = automatic backup before restore';

COMMENT ON COLUMN clinic_snapshots.storage_path IS
'Path in Supabase Storage bucket: {clinic_id}/snapshots/{snapshot_id}.json.gz';

COMMENT ON COLUMN clinic_snapshots.table_manifest IS
'JSON array of tables included with record counts and checksums';

-- ============================================================================
-- 3. RLS Policies (Only Owner Can Manage Snapshots)
-- ============================================================================

ALTER TABLE clinic_snapshots ENABLE ROW LEVEL SECURITY;

-- View policy: Users can see snapshots for their clinics
CREATE POLICY "clinic_snapshots_select_policy"
ON clinic_snapshots FOR SELECT
USING (
  clinic_id IN (
    SELECT cu.clinic_id
    FROM clinic_users cu
    WHERE cu.user_id = auth.uid()
  )
);

-- Insert policy: Only owners can create snapshots
CREATE POLICY "clinic_snapshots_insert_policy"
ON clinic_snapshots FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clinic_users cu
    WHERE cu.clinic_id = clinic_snapshots.clinic_id
    AND cu.user_id = auth.uid()
    AND cu.role = 'owner'
  )
);

-- Update policy: Only owners can update snapshots
CREATE POLICY "clinic_snapshots_update_policy"
ON clinic_snapshots FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clinic_users cu
    WHERE cu.clinic_id = clinic_snapshots.clinic_id
    AND cu.user_id = auth.uid()
    AND cu.role = 'owner'
  )
);

-- Delete policy: Only owners can delete snapshots
CREATE POLICY "clinic_snapshots_delete_policy"
ON clinic_snapshots FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clinic_users cu
    WHERE cu.clinic_id = clinic_snapshots.clinic_id
    AND cu.user_id = auth.uid()
    AND cu.role = 'owner'
  )
);

-- ============================================================================
-- 4. Cleanup Function for Expired Snapshots
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete expired snapshots
  -- Note: Storage cleanup must be done separately via API
  WITH deleted AS (
    DELETE FROM clinic_snapshots
    WHERE expires_at < now()
    AND status = 'completed'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_snapshots() IS
'Deletes expired snapshot metadata. Should be called by cron job. Storage files must be deleted separately.';

-- ============================================================================
-- 5. Helper Function to Get Latest Snapshot
-- ============================================================================

CREATE OR REPLACE FUNCTION get_latest_snapshot(p_clinic_id uuid)
RETURNS clinic_snapshots
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT *
  FROM clinic_snapshots
  WHERE clinic_id = p_clinic_id
  AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_latest_snapshot(uuid) IS
'Returns the most recent completed snapshot for a clinic.';

-- ============================================================================
-- 6. Grant Permissions
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION discover_clinic_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_foreign_keys(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_snapshot(uuid) TO authenticated;

-- Service role only for cleanup
GRANT EXECUTE ON FUNCTION cleanup_expired_snapshots() TO service_role;

-- ============================================================================
-- 7. Storage Bucket Setup (Run in Supabase Dashboard SQL Editor)
-- ============================================================================

-- NOTE: This must be run separately in Supabase Dashboard because
-- storage bucket creation requires special permissions.
-- Copy and run this in SQL Editor:

/*
-- Create storage bucket for clinic snapshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinic-snapshots',
  'clinic-snapshots',
  false,
  104857600,  -- 100MB
  ARRAY['application/json', 'application/gzip', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for bucket: Only clinic owners can manage their snapshots
CREATE POLICY "clinic_snapshots_storage_policy"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'clinic-snapshots'
  AND (storage.foldername(name))[1] IN (
    SELECT cu.clinic_id::text
    FROM clinic_users cu
    WHERE cu.user_id = auth.uid()
    AND cu.role = 'owner'
  )
)
WITH CHECK (
  bucket_id = 'clinic-snapshots'
  AND (storage.foldername(name))[1] IN (
    SELECT cu.clinic_id::text
    FROM clinic_users cu
    WHERE cu.user_id = auth.uid()
    AND cu.role = 'owner'
  )
);
*/
