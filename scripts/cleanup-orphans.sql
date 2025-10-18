-- Migration: Cleanup all orphaned records
-- This script identifies and deletes orphaned records in the database
-- Date: 2025-10-15

-- ==============================================================================
-- STEP 1: Find and delete orphaned workspace_members
-- ==============================================================================

-- workspace_members sin workspace válido
DELETE FROM public.workspace_members
WHERE workspace_id NOT IN (SELECT id FROM public.workspaces);

-- workspace_members sin usuario válido (si user_id existe en auth.users)
DELETE FROM public.workspace_members
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- ==============================================================================
-- STEP 2: Find and delete orphaned workspaces
-- ==============================================================================

-- workspaces sin owner válido
DELETE FROM public.workspaces
WHERE owner_id IS NOT NULL
  AND owner_id NOT IN (SELECT id FROM auth.users);

-- ==============================================================================
-- STEP 3: Find and delete orphaned clinics
-- ==============================================================================

-- clinics sin workspace válido
DELETE FROM public.clinics
WHERE workspace_id IS NOT NULL
  AND workspace_id NOT IN (SELECT id FROM public.workspaces);

-- ==============================================================================
-- STEP 4: Find and delete orphaned clinic data
-- ==============================================================================

-- settings_time huérfanos
DELETE FROM public.settings_time
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- fixed_costs huérfanos
DELETE FROM public.fixed_costs
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- assets huérfanos
DELETE FROM public.assets
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- supplies huérfanos
DELETE FROM public.supplies
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- services huérfanos
DELETE FROM public.services
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- service_supplies huérfanos (por service_id)
DELETE FROM public.service_supplies
WHERE service_id NOT IN (SELECT id FROM public.services);

-- service_supplies huérfanos (por supply_id)
DELETE FROM public.service_supplies
WHERE supply_id NOT IN (SELECT id FROM public.supplies);

-- patients huérfanos
DELETE FROM public.patients
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- treatments huérfanos (por clinic_id)
DELETE FROM public.treatments
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- treatments huérfanos (por patient_id)
DELETE FROM public.treatments
WHERE patient_id NOT IN (SELECT id FROM public.patients);

-- expenses huérfanos
DELETE FROM public.expenses
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- tariffs huérfanos
DELETE FROM public.tariffs
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- ==============================================================================
-- STEP 5: Find and delete orphaned categories
-- ==============================================================================

-- categories huérfanas (solo las que tienen clinic_id)
DELETE FROM public.categories
WHERE clinic_id IS NOT NULL
  AND clinic_id NOT IN (SELECT id FROM public.clinics);

-- category_types huérfanos (si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'category_types' AND table_schema = 'public') THEN
        DELETE FROM public.category_types
        WHERE clinic_id IS NOT NULL
          AND clinic_id NOT IN (SELECT id FROM public.clinics);
    END IF;
END $$;

-- expense_categories huérfanas (si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'expense_categories' AND table_schema = 'public') THEN
        DELETE FROM public.expense_categories
        WHERE clinic_id IS NOT NULL
          AND clinic_id NOT IN (SELECT id FROM public.clinics);
    END IF;
END $$;

-- ==============================================================================
-- STEP 6: Find and delete orphaned marketing data
-- ==============================================================================

-- marketing_platforms huérfanos (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'marketing_platforms' AND table_schema = 'public') THEN
        DELETE FROM public.marketing_platforms
        WHERE clinic_id NOT IN (SELECT id FROM public.clinics);
    END IF;
END $$;

-- marketing_campaigns huérfanos (por clinic_id)
DELETE FROM public.marketing_campaigns
WHERE clinic_id NOT IN (SELECT id FROM public.clinics);

-- marketing_campaign_status_history huérfanos
DELETE FROM public.marketing_campaign_status_history
WHERE campaign_id NOT IN (SELECT id FROM public.marketing_campaigns);

-- ==============================================================================
-- STEP 7: Find and delete orphaned workspace_activity
-- ==============================================================================

-- workspace_activity huérfana (por workspace_id)
DELETE FROM public.workspace_activity
WHERE workspace_id NOT IN (SELECT id FROM public.workspaces);

-- workspace_activity huérfana (por clinic_id si no es NULL)
DELETE FROM public.workspace_activity
WHERE clinic_id IS NOT NULL
  AND clinic_id NOT IN (SELECT id FROM public.clinics);

-- ==============================================================================
-- STEP 8: Find and delete orphaned verification_codes
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'verification_codes' AND table_schema = 'public') THEN
        -- Códigos expirados (más de 24 horas)
        DELETE FROM public.verification_codes
        WHERE expires_at < NOW() - INTERVAL '24 hours';

        -- Códigos ya usados (más de 7 días)
        DELETE FROM public.verification_codes
        WHERE used = true AND created_at < NOW() - INTERVAL '7 days';

        -- Códigos huérfanos (user_id no válido)
        DELETE FROM public.verification_codes
        WHERE user_id IS NOT NULL
          AND user_id NOT IN (SELECT id FROM auth.users);
    END IF;
END $$;

-- ==============================================================================
-- STEP 9: Find and delete orphaned users table records
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'users' AND table_schema = 'public') THEN
        DELETE FROM public.users
        WHERE id NOT IN (SELECT id FROM auth.users);
    END IF;
END $$;

-- ==============================================================================
-- VERIFICATION: Count remaining records by table
-- ==============================================================================

-- Contar registros en cada tabla
SELECT
    'workspaces' as table_name,
    COUNT(*) as record_count
FROM public.workspaces
UNION ALL
SELECT 'workspace_members', COUNT(*) FROM public.workspace_members
UNION ALL
SELECT 'workspace_activity', COUNT(*) FROM public.workspace_activity
UNION ALL
SELECT 'clinics', COUNT(*) FROM public.clinics
UNION ALL
SELECT 'settings_time', COUNT(*) FROM public.settings_time
UNION ALL
SELECT 'fixed_costs', COUNT(*) FROM public.fixed_costs
UNION ALL
SELECT 'assets', COUNT(*) FROM public.assets
UNION ALL
SELECT 'supplies', COUNT(*) FROM public.supplies
UNION ALL
SELECT 'services', COUNT(*) FROM public.services
UNION ALL
SELECT 'service_supplies', COUNT(*) FROM public.service_supplies
UNION ALL
SELECT 'patients', COUNT(*) FROM public.patients
UNION ALL
SELECT 'treatments', COUNT(*) FROM public.treatments
UNION ALL
SELECT 'expenses', COUNT(*) FROM public.expenses
UNION ALL
SELECT 'tariffs', COUNT(*) FROM public.tariffs
UNION ALL
SELECT 'categories', COUNT(*) FROM public.categories
UNION ALL
SELECT 'marketing_campaigns', COUNT(*) FROM public.marketing_campaigns
UNION ALL
SELECT 'marketing_campaign_status_history', COUNT(*) FROM public.marketing_campaign_status_history
ORDER BY table_name;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================
SELECT '✅ Cleanup completed: All orphaned records have been deleted' as status;