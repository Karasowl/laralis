-- Analysis: Find all orphaned records WITHOUT deleting them
-- This script only SHOWS orphaned records, use with SELECT
-- Date: 2025-10-15

-- ==============================================================================
-- ANALYSIS: Count orphaned records in each table
-- ==============================================================================

-- workspace_members huérfanos
SELECT
    'workspace_members (no workspace)' as orphan_type,
    COUNT(*) as orphan_count
FROM public.workspace_members
WHERE workspace_id NOT IN (SELECT id FROM public.workspaces)

UNION ALL

SELECT
    'workspace_members (no user)',
    COUNT(*)
FROM public.workspace_members
WHERE user_id NOT IN (SELECT id FROM auth.users)

UNION ALL

-- workspaces huérfanos
SELECT
    'workspaces (no owner)',
    COUNT(*)
FROM public.workspaces
WHERE owner_id IS NOT NULL
  AND owner_id NOT IN (SELECT id FROM auth.users)

UNION ALL

-- clinics huérfanas
SELECT
    'clinics (no workspace)',
    COUNT(*)
FROM public.clinics
WHERE workspace_id IS NOT NULL
  AND workspace_id NOT IN (SELECT id FROM public.workspaces)

UNION ALL

-- settings_time huérfanos
SELECT
    'settings_time',
    COUNT(*)
FROM public.settings_time
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- fixed_costs huérfanos
SELECT
    'fixed_costs',
    COUNT(*)
FROM public.fixed_costs
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- assets huérfanos
SELECT
    'assets',
    COUNT(*)
FROM public.assets
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- supplies huérfanos
SELECT
    'supplies',
    COUNT(*)
FROM public.supplies
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- services huérfanos
SELECT
    'services',
    COUNT(*)
FROM public.services
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- service_supplies huérfanos (service)
SELECT
    'service_supplies (no service)',
    COUNT(*)
FROM public.service_supplies
WHERE service_id NOT IN (SELECT id FROM public.services)

UNION ALL

-- service_supplies huérfanos (supply)
SELECT
    'service_supplies (no supply)',
    COUNT(*)
FROM public.service_supplies
WHERE supply_id NOT IN (SELECT id FROM public.supplies)

UNION ALL

-- patients huérfanos
SELECT
    'patients',
    COUNT(*)
FROM public.patients
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- treatments huérfanos (clinic)
SELECT
    'treatments (no clinic)',
    COUNT(*)
FROM public.treatments
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- treatments huérfanos (patient)
SELECT
    'treatments (no patient)',
    COUNT(*)
FROM public.treatments
WHERE patient_id NOT IN (SELECT id FROM public.patients)

UNION ALL

-- expenses huérfanos
SELECT
    'expenses',
    COUNT(*)
FROM public.expenses
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- tariffs huérfanos
SELECT
    'tariffs',
    COUNT(*)
FROM public.tariffs
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- categories huérfanas
SELECT
    'categories (custom)',
    COUNT(*)
FROM public.categories
WHERE clinic_id IS NOT NULL
  AND clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- marketing_campaigns huérfanas
SELECT
    'marketing_campaigns',
    COUNT(*)
FROM public.marketing_campaigns
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)

UNION ALL

-- marketing_campaign_status_history huérfanas
SELECT
    'campaign_status_history',
    COUNT(*)
FROM public.marketing_campaign_status_history
WHERE campaign_id NOT IN (SELECT id FROM public.marketing_campaigns)

UNION ALL

-- workspace_activity huérfana
SELECT
    'workspace_activity (workspace)',
    COUNT(*)
FROM public.workspace_activity
WHERE workspace_id NOT IN (SELECT id FROM public.workspaces)

UNION ALL

SELECT
    'workspace_activity (clinic)',
    COUNT(*)
FROM public.workspace_activity
WHERE clinic_id IS NOT NULL
  AND clinic_id NOT IN (SELECT id FROM public.clinics)

ORDER BY orphan_count DESC, orphan_type;

-- ==============================================================================
-- DETAILED VIEW: Show actual orphaned records (first 10 of each type)
-- ==============================================================================

-- Mostrar ejemplos de workspace_members huérfanos
SELECT
    'workspace_members' as table_name,
    id,
    workspace_id,
    user_id,
    email
FROM public.workspace_members
WHERE workspace_id NOT IN (SELECT id FROM public.workspaces)
   OR user_id NOT IN (SELECT id FROM auth.users)
LIMIT 10;

-- Mostrar ejemplos de clinics huérfanas
SELECT
    'clinics' as table_name,
    id,
    name,
    workspace_id
FROM public.clinics
WHERE workspace_id IS NOT NULL
  AND workspace_id NOT IN (SELECT id FROM public.workspaces)
LIMIT 10;

-- Mostrar ejemplos de patients huérfanos
SELECT
    'patients' as table_name,
    id,
    first_name,
    last_name,
    clinic_id
FROM public.patients
WHERE clinic_id NOT IN (SELECT id FROM public.clinics)
LIMIT 10;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================
SELECT
    'Total orphaned records analysis complete' as status,
    'Run 30_cleanup_orphaned_records.sql to delete them' as next_step;